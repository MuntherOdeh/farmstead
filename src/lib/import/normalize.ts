import Decimal from "decimal.js";
import synonyms from "./synonyms.json";
import { isoFromDate, parseFlexibleDate } from "./dates";
import { normalizeHeader } from "./text";
import type {
  DefaultTxType,
  ImportMapping,
  NormalizedRow,
  ParsedCell,
  ParsedSheet,
} from "./types";

// Apply the (user-confirmed) mapping to the parsed grid, producing normalized
// rows ready for preview and commit. Raw values stay recoverable — the commit
// stores both raw and normalized per row (SPEC §5.4).

const VALUES = synonyms.values as unknown as {
  sale: string[];
  purchase: string[];
  birth: string[];
  death: string[];
  expense: string[];
  currencySymbols: Record<string, string>;
};

const CURRENCY_STRIP = /[$€£¥﷼]|US\$|ر\.س|د\.إ|د\.ا|ج\.م|JD|USD|EUR|GBP|SAR|AED|JOD/g;

function cellToDecimalString(cell: ParsedCell): string | null {
  if (cell.v === null) return null;
  if (typeof cell.v === "number") {
    return Number.isFinite(cell.v) ? new Decimal(cell.v).toString() : null;
  }
  if (typeof cell.v === "string") {
    const cleaned = cell.v.replace(CURRENCY_STRIP, "").replace(/[,\s]/g, "").replace(/%$/, "").trim();
    if (cleaned === "") return null;
    try {
      const d = new Decimal(cleaned);
      return d.isFinite() ? d.toString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

function cellToText(cell: ParsedCell): string | null {
  if (cell.v === null) return null;
  if (cell.v instanceof Date) return isoFromDate(cell.v);
  const text = String(cell.v).trim();
  return text === "" ? null : text;
}

function cellToIsoDate(cell: ParsedCell, order: "DMY" | "MDY"): string | null {
  if (cell.v instanceof Date) return isoFromDate(cell.v);
  if (typeof cell.v === "string") return parseFlexibleDate(cell.v, order).iso;
  if (typeof cell.v === "number" && cell.z && /[dy]/i.test(cell.z)) {
    // Rare: a date serial that escaped cellDates. 1900 epoch day 25569 = 1970-01-01.
    const ms = (cell.v - 25569) * 86400 * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : isoFromDate(date);
  }
  return null;
}

const TX_LOOKUP: Array<[DefaultTxType, string[]]> = [
  ["sale", VALUES.sale],
  ["purchase", VALUES.purchase],
  ["birth", VALUES.birth],
  ["death", VALUES.death],
  ["expense", VALUES.expense],
];

export function mapTransactionType(raw: string): DefaultTxType | null {
  const normalized = normalizeHeader(raw);
  for (const [type, words] of TX_LOOKUP) {
    if (words.some((word) => normalizeHeader(word) === normalized)) return type;
  }
  return null;
}

export function normalizeRows(sheet: ParsedSheet, mapping: ImportMapping): NormalizedRow[] {
  const byIndex = new Map(sheet.columns.map((column) => [column.index, column]));
  const included = mapping.columns.filter((column) => column.include);
  const roleColumn = (role: string) => included.find((column) => column.role === role);

  const dateCol = roleColumn("period");
  const nameCol = roleColumn("entity_name");
  const categoryCol = roleColumn("entity_type");
  const qtyCol = roleColumn("quantity");
  const unitCol = roleColumn("unit");
  const priceCol = roleColumn("unit_price");
  const totalCol = roleColumn("total_amount");
  const partyCol = roleColumn("party");
  const typeCol = roleColumn("transaction_type");
  const notesCol = roleColumn("notes");
  const handled = new Set(
    [dateCol, nameCol, categoryCol, qtyCol, unitCol, priceCol, totalCol, partyCol, typeCol, notesCol]
      .filter(Boolean)
      .map((column) => column!.index),
  );

  const rows: NormalizedRow[] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const cellAt = (index: number | undefined): ParsedCell =>
      index === undefined ? { v: null } : (byIndex.get(index)?.cells[r] ?? { v: null });

    const problems: string[] = [];
    const rawDate = cellAt(dateCol?.index);
    const date = dateCol ? cellToIsoDate(rawDate, dateCol.dateOrder) : null;
    if (dateCol && rawDate.v !== null && date === null) {
      problems.push(`${dateCol.header}: "${String(rawDate.v)}" is not a date`);
    }

    const qtyRaw = cellAt(qtyCol?.index);
    let qty = qtyCol ? cellToDecimalString(qtyRaw) : null;
    if (qtyCol && qtyRaw.v !== null && qty === null) {
      problems.push(`${qtyCol.header}: "${String(qtyRaw.v)}" is not a number`);
    }

    // Arabic ledgers often embed the quantity in the item name — "غنم عدد 6"
    // (six head) or "جبنة 33كغ" (33 kg). When no quantity column supplied a
    // value, pull it out of the name.
    let productName = nameCol ? cellToText(cellAt(nameCol.index)) : null;
    let embeddedUnit: string | null = null;
    if (productName && qty === null) {
      const head = productName.match(/^(.*?)\s*عدد\s*(\d+(?:[.,]\d+)?)\s*$/);
      const mass = productName.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*(?:كغ|كيلو)\s*$/);
      if (head) {
        productName = head[1].trim() || productName;
        qty = head[2].replace(",", ".");
        embeddedUnit = "head";
      } else if (mass) {
        productName = mass[1].trim() || productName;
        qty = mass[2].replace(",", ".");
        embeddedUnit = "kg";
      }
    }

    const priceRaw = cellAt(priceCol?.index);
    let unitPrice = priceCol ? cellToDecimalString(priceRaw) : null;
    if (priceCol && priceRaw.v !== null && unitPrice === null) {
      problems.push(`${priceCol.header}: "${String(priceRaw.v)}" is not a number`);
    }

    const totalRaw = cellAt(totalCol?.index);
    let total = totalCol ? cellToDecimalString(totalRaw) : null;
    if (totalCol && totalRaw.v !== null && total === null) {
      problems.push(`${totalCol.header}: "${String(totalRaw.v)}" is not a number`);
    }

    // Derivations (SPEC §5.2): fill the missing leg of qty × price = total.
    if (qty !== null) {
      const q = new Decimal(qty);
      if (total === null && unitPrice !== null) {
        total = q.mul(unitPrice).toDecimalPlaces(2).toString();
      } else if (unitPrice === null && total !== null && !q.isZero()) {
        unitPrice = new Decimal(total).div(q).toDecimalPlaces(4).toString();
      } else if (
        unitPrice !== null &&
        total !== null &&
        mapping.authoritativeAmount === "unit_price"
      ) {
        total = q.mul(unitPrice).toDecimalPlaces(2).toString();
      }
    } else if (qty === null && unitPrice !== null && total !== null) {
      qty = "1";
    }

    const typeText = typeCol ? cellToText(cellAt(typeCol.index)) : null;
    const type = typeText ? mapTransactionType(typeText) : null;
    if (typeText && type === null) {
      problems.push(`${typeCol!.header}: unknown type "${typeText}"`);
    }

    const extras: NormalizedRow["extras"] = {};
    for (const column of included) {
      if (handled.has(column.index)) continue;
      const cell = cellAt(column.index);
      if (cell.v === null) {
        extras[column.header] = null;
      } else if (cell.v instanceof Date) {
        extras[column.header] = isoFromDate(cell.v);
      } else {
        extras[column.header] = cell.v;
      }
    }

    rows.push({
      rowIndex: r,
      date,
      productName,
      categoryName: categoryCol ? cellToText(cellAt(categoryCol.index)) : null,
      qty,
      unitCode: (unitCol ? cellToText(cellAt(unitCol.index)) : null) ?? embeddedUnit,
      unitPrice,
      total,
      party: partyCol ? cellToText(cellAt(partyCol.index)) : null,
      type,
      notes: notesCol ? cellToText(cellAt(notesCol.index)) : null,
      extras,
      problems,
    });
  }

  // Drop rows that are entirely empty after normalization.
  return rows.filter(
    (row) =>
      row.date !== null ||
      row.productName !== null ||
      row.qty !== null ||
      row.total !== null ||
      Object.values(row.extras).some((value) => value !== null),
  );
}
