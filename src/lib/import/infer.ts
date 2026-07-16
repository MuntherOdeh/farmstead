import synonyms from "./synonyms.json";
import { parseFlexibleDate } from "./dates";
import { fuzzyEquals, normalizeHeader } from "./text";
import type {
  CrossChecks,
  InferredColumn,
  InferredSchema,
  ParsedCell,
  ParsedColumn,
  ParsedSheet,
  PhysicalType,
  SemanticRole,
} from "./types";

// Column inference (SPEC §5.2): score every candidate type per sampled cell —
// the Excel NUMBER FORMAT is stronger evidence than any regex on the value —
// then pick a semantic role from header synonyms + value patterns.

const SAMPLE_LIMIT = 500;

const ROLE_SYNONYMS = synonyms.roles as Record<string, string[]>;
const VALUE_DICTIONARIES = synonyms.values as unknown as {
  livestock: string[];
  products: string[];
  units: string[];
  sale: string[];
  purchase: string[];
  birth: string[];
  death: string[];
  expense: string[];
  currencySymbols: Record<string, string>;
};

const CURRENCY_SYMBOL_PATTERN = /[$€£¥﷼]|US\$|ر\.س|د\.إ|د\.ا|ج\.م|\bJD\b|\bUSD\b|\bEUR\b|\bGBP\b|\bSAR\b|\bAED\b|\bJOD\b/;
const BOOLEAN_WORDS = new Set(["true", "false", "yes", "no", "y", "n", "نعم", "لا"]);

function isDateFormat(z: string): boolean {
  const cleaned = z.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
  return /[dy]/i.test(cleaned) && /m/i.test(cleaned) && !/#|0/.test(cleaned);
}

function isDurationFormat(z: string): boolean {
  return /\[h+\]|h+[:.]mm/i.test(z);
}

function isCurrencyFormat(z: string): boolean {
  return CURRENCY_SYMBOL_PATTERN.test(z) || /\p{Sc}/u.test(z);
}

const NUMERIC_STRING = /^-?\s*(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d+)?\s*$/;

export function classifyCell(cell: ParsedCell): PhysicalType {
  const { v, z } = cell;
  if (v === null) return "empty";
  if (v instanceof Date) return "date";
  if (typeof v === "boolean") return "boolean";

  if (typeof v === "number") {
    if (z) {
      if (z.includes("%")) return "percent";
      if (isDurationFormat(z)) return "duration";
      if (isCurrencyFormat(z)) return "currency";
      if (isDateFormat(z)) return "date";
    }
    return Number.isInteger(v) ? "integer" : "decimal";
  }

  const text = String(v).trim();
  if (text === "") return "empty";
  if (BOOLEAN_WORDS.has(text.toLowerCase())) return "boolean";
  if (/^-?\s*[\d,.]+\s*%$/.test(text)) return "percent";
  if (
    CURRENCY_SYMBOL_PATTERN.test(text) &&
    NUMERIC_STRING.test(text.replace(CURRENCY_SYMBOL_PATTERN, "").trim())
  ) {
    return "currency";
  }
  if (NUMERIC_STRING.test(text)) {
    return text.includes(".") ? "decimal" : "integer";
  }
  if (parseFlexibleDate(text).iso !== null) return "date";
  return "text";
}

interface TypeResult {
  type: PhysicalType;
  confidence: number;
  ambiguousDate: boolean;
}

export function inferPhysicalType(cells: ParsedCell[]): TypeResult {
  const samples = cells.filter((cell) => cell.v !== null).slice(0, SAMPLE_LIMIT);
  if (samples.length === 0) return { type: "empty", confidence: 1, ambiguousDate: false };

  const counts = new Map<PhysicalType, number>();
  for (const cell of samples) {
    const type = classifyCell(cell);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  // integer ⊂ decimal ⊂ currency: merge upward so "12" among prices counts.
  const merged = new Map(counts);
  if (merged.has("currency")) {
    merged.set(
      "currency",
      (merged.get("currency") ?? 0) + (merged.get("decimal") ?? 0) + (merged.get("integer") ?? 0),
    );
    merged.delete("decimal");
    merged.delete("integer");
  } else if (merged.has("decimal")) {
    merged.set("decimal", (merged.get("decimal") ?? 0) + (merged.get("integer") ?? 0));
    merged.delete("integer");
  }

  let winner: PhysicalType = "text";
  let winnerCount = 0;
  for (const [type, count] of merged) {
    if (count > winnerCount) {
      winner = type;
      winnerCount = count;
    }
  }
  let confidence = winnerCount / samples.length;

  // Ambiguous string dates: flag when at least one sample is order-ambiguous
  // and no sample pins the order down (day > 12 disambiguates the column).
  let ambiguousDate = false;
  if (winner === "date") {
    let sawAmbiguous = false;
    let sawPinned = false;
    for (const cell of samples) {
      if (typeof cell.v !== "string") continue;
      const match = cell.v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/);
      if (!match) continue;
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (a <= 12 && b <= 12 && a !== b) sawAmbiguous = true;
      if (a > 12 || b > 12) sawPinned = true;
    }
    ambiguousDate = sawAmbiguous && !sawPinned;
  }

  // category refinement: repetitive text (SPEC: distinct/total ≤0.3, ≤50)
  if (winner === "text") {
    const distinct = new Set(samples.map((cell) => String(cell.v).trim().toLowerCase())).size;
    const compactCode = (value: unknown) =>
      typeof value === "string" &&
      value.length <= 24 &&
      /^[\p{L}\p{N}][\p{L}\p{N}_\-#/.]*$/u.test(value);
    if (distinct / samples.length <= 0.3 && distinct <= 50) {
      winner = "category";
    } else if (
      distinct / samples.length >= 0.97 &&
      samples.length >= 10 &&
      samples.every((cell) => compactCode(cell.v))
    ) {
      winner = "id";
    }
  }
  if (winner === "integer") {
    const distinct = new Set(samples.map((cell) => String(cell.v))).size;
    if (distinct / samples.length >= 0.97 && samples.length >= 20) {
      const spread = samples.every((cell) => typeof cell.v === "number" && cell.v > 1000);
      if (spread) winner = "id";
    }
  }
  if (confidence < 0.5) {
    winner = "text";
    confidence = 1 - confidence;
  }

  return { type: winner, confidence, ambiguousDate };
}

function headerRoleMatch(header: string): { role: SemanticRole; exact: boolean } | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  const words = normalized.split(" ");
  // Pass 1 — EXACT across every role first: short words in any language sit
  // within edit distance 2 of each other far too often (السعر vs الشهر).
  for (const [role, aliases] of Object.entries(ROLE_SYNONYMS)) {
    for (const alias of aliases) {
      if (normalized === normalizeHeader(alias)) {
        return { role: role as SemanticRole, exact: true };
      }
    }
  }
  // Pass 2 — fuzzy (typos like "Quantitty").
  for (const [role, aliases] of Object.entries(ROLE_SYNONYMS)) {
    for (const alias of aliases) {
      if (fuzzyEquals(normalized, normalizeHeader(alias))) {
        return { role: role as SemanticRole, exact: false };
      }
    }
  }
  // Pass 3 — whole-alias contained in a multiword header ("sale date").
  for (const [role, aliases] of Object.entries(ROLE_SYNONYMS)) {
    for (const alias of aliases) {
      const na = normalizeHeader(alias);
      if (na.includes(" ") ? normalized.includes(na) : words.includes(na)) {
        return { role: role as SemanticRole, exact: false };
      }
    }
  }
  return null;
}

function dictionaryHitRate(cells: ParsedCell[], dictionary: string[]): number {
  const samples = cells.filter((c) => typeof c.v === "string").slice(0, SAMPLE_LIMIT);
  if (samples.length === 0) return 0;
  const dict = new Set(dictionary.map((word) => normalizeHeader(word)));
  let hits = 0;
  for (const cell of samples) {
    const tokens = normalizeHeader(String(cell.v)).split(" ");
    if (tokens.some((token) => dict.has(token))) hits++;
  }
  return hits / samples.length;
}

function transactionTypeHitRate(cells: ParsedCell[]): number {
  const dict = [
    ...VALUE_DICTIONARIES.sale,
    ...VALUE_DICTIONARIES.purchase,
    ...VALUE_DICTIONARIES.birth,
    ...VALUE_DICTIONARIES.death,
    ...VALUE_DICTIONARIES.expense,
  ];
  return dictionaryHitRate(cells, dict);
}

export function inferRole(
  column: ParsedColumn,
  physical: TypeResult,
): { role: SemanticRole; confidence: number } {
  const headerMatch = headerRoleMatch(column.header);
  const type = physical.type;
  const numeric = type === "integer" || type === "decimal" || type === "currency";

  if (headerMatch) {
    const base = headerMatch.exact ? 0.9 : 0.75;
    const role = headerMatch.role;
    // Header must not contradict the physical type.
    const compatible =
      (role === "period" && (type === "date" || type === "text")) ||
      (["quantity", "unit_price", "total_amount", "cost", "weight", "age"].includes(role) &&
        (numeric || type === "percent")) ||
      ["entity_type", "entity_name", "unit", "party", "location", "transaction_type", "breed", "sex", "notes", "tag_id"].includes(role);
    if (compatible) return { role, confidence: base };
  }

  // Value-pattern evidence.
  if (type === "date") return { role: "period", confidence: 0.7 };
  if (type === "category" || type === "text") {
    if (dictionaryHitRate(column.cells, VALUE_DICTIONARIES.units) >= 0.6) {
      return { role: "unit", confidence: 0.7 };
    }
    if (transactionTypeHitRate(column.cells) >= 0.6) {
      return { role: "transaction_type", confidence: 0.7 };
    }
    const productHits =
      dictionaryHitRate(column.cells, VALUE_DICTIONARIES.livestock) +
      dictionaryHitRate(column.cells, VALUE_DICTIONARIES.products);
    if (productHits >= 0.5) return { role: "entity_name", confidence: 0.6 };
    const sexHits = dictionaryHitRate(column.cells, ["m", "f", "male", "female", "ذكر", "انثي"]);
    if (sexHits >= 0.8) return { role: "sex", confidence: 0.7 };
  }
  if (type === "id") return { role: "tag_id", confidence: 0.6 };
  if (type === "currency") return { role: "total_amount", confidence: 0.4 };
  if (numeric) return { role: "measure", confidence: 0.4 };
  if (type === "percent") return { role: "measure", confidence: 0.5 };
  return { role: "dimension", confidence: 0.4 };
}

function detectCurrency(columns: ParsedColumn[]): string | null {
  const symbolMap = VALUE_DICTIONARIES.currencySymbols;
  const tally = new Map<string, number>();
  for (const column of columns) {
    for (const cell of column.cells.slice(0, SAMPLE_LIMIT)) {
      const sources = [cell.z ?? "", typeof cell.v === "string" ? cell.v : "", cell.w ?? ""];
      for (const source of sources) {
        for (const [symbol, code] of Object.entries(symbolMap)) {
          if (source.includes(symbol)) tally.set(code, (tally.get(code) ?? 0) + 1);
        }
      }
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [code, count] of tally) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

function detectMixedUnits(column: ParsedColumn): string[] | null {
  const dict = new Set(VALUE_DICTIONARIES.units.map((u) => normalizeHeader(u)));
  const seen = new Set<string>();
  for (const cell of column.cells.slice(0, SAMPLE_LIMIT)) {
    if (typeof cell.v !== "string") continue;
    const token = normalizeHeader(cell.v);
    if (dict.has(token)) seen.add(token);
  }
  // kg + lb (or any mass/volume mixture) inside one column is a flag.
  const MASS = new Set(["kg", "g", "gram", "ton", "tonne", "lb", "lbs", "pound", "كغ", "كيلو", "غرام", "طن"]);
  const VOLUME = new Set(["litre", "liter", "l", "ml", "gallon", "gal", "لتر"]);
  const masses = [...seen].filter((u) => MASS.has(u));
  const volumes = [...seen].filter((u) => VOLUME.has(u));
  if (masses.length > 1 || volumes.length > 1 || (masses.length > 0 && volumes.length > 0)) {
    return [...seen];
  }
  return null;
}

const toNumber = (cell: ParsedCell): number | null => {
  if (typeof cell.v === "number") return cell.v;
  if (typeof cell.v === "string") {
    const cleaned = cell.v.replace(CURRENCY_SYMBOL_PATTERN, "").replace(/[,\s]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function crossColumnChecks(
  sheet: ParsedSheet,
  inferred: InferredColumn[],
): CrossChecks {
  const byRole = (role: SemanticRole) => inferred.find((column) => column.role === role);
  const qty = byRole("quantity");
  const price = byRole("unit_price");
  const total = byRole("total_amount");

  let qtyPriceTotal: CrossChecks["qtyPriceTotal"] = null;
  if (qty && price && total) {
    const qtyCol = sheet.columns.find((c) => c.index === qty.index)!;
    const priceCol = sheet.columns.find((c) => c.index === price.index)!;
    const totalCol = sheet.columns.find((c) => c.index === total.index)!;
    let checked = 0;
    let matched = 0;
    const anomalyRows: number[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      const q = toNumber(qtyCol.cells[r] ?? { v: null });
      const p = toNumber(priceCol.cells[r] ?? { v: null });
      const t = toNumber(totalCol.cells[r] ?? { v: null });
      if (q === null || p === null || t === null) continue;
      checked++;
      const expected = q * p;
      const tolerance = Math.max(0.01, Math.abs(t) * 0.01); // >1% → anomaly
      if (Math.abs(expected - t) <= tolerance) {
        matched++;
      } else {
        anomalyRows.push(r);
      }
    }
    if (checked > 0) {
      qtyPriceTotal = {
        qtyIndex: qty.index,
        priceIndex: price.index,
        totalIndex: total.index,
        matchRate: matched / checked,
        anomalyRows,
      };
    }
  }

  return {
    qtyPriceTotal,
    deriveUnitPrice: Boolean(qty && total && !price),
    detectedCurrency: detectCurrency(sheet.columns),
  };
}

export function inferSchema(sheet: ParsedSheet): InferredSchema {
  const columns: InferredColumn[] = sheet.columns.map((column) => {
    const physical = inferPhysicalType(column.cells);
    const { role, confidence: roleConfidence } = inferRole(column, physical);
    const nonEmpty = column.cells.filter((cell) => cell.v !== null);
    const distinct = new Set(nonEmpty.map((cell) => String(cell.v).trim().toLowerCase())).size;
    const samples = nonEmpty.slice(0, 3).map((cell) => cell.w ?? String(cell.v));
    return {
      index: column.index,
      header: column.header,
      physicalType: physical.type,
      typeConfidence: Number(physical.confidence.toFixed(2)),
      role,
      roleConfidence: Number(roleConfidence.toFixed(2)),
      unitCode: null,
      currency: null,
      ambiguousDate: physical.ambiguousDate,
      distinctCount: distinct,
      blankCount: column.cells.length - nonEmpty.length,
      samples,
      mixedUnits: role === "unit" ? detectMixedUnits(column) : null,
    };
  });

  // If two columns claim the same money role, prefer the larger mean as total.
  const moneyColumns = columns.filter((c) => c.role === "total_amount");
  if (moneyColumns.length > 1) {
    const means = moneyColumns.map((col) => {
      const parsedColumn = sheet.columns.find((c) => c.index === col.index)!;
      const numbers = parsedColumn.cells
        .map(toNumber)
        .filter((n): n is number => n !== null);
      const mean = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
      return { col, mean };
    });
    means.sort((a, b) => b.mean - a.mean);
    for (let i = 1; i < means.length; i++) {
      means[i].col.role = "unit_price";
    }
  }

  return { columns, crossChecks: crossColumnChecks(sheet, columns) };
}
