import { describe, expect, it } from "vitest";
import { normalizeRows } from "../normalize";
import { computeQuality } from "../quality";
import { headerSignature } from "../signature";
import { parseSheet, readWorkbook, detectHeaderRow } from "../parse";
import * as XLSX from "xlsx";
import type { ImportMapping } from "../types";
import { column, sheet } from "./helpers";

function mappingFor(
  s: ReturnType<typeof sheet>,
  roles: Record<string, ImportMapping["columns"][number]["role"]>,
  overrides?: Partial<ImportMapping>,
): ImportMapping {
  return {
    columns: s.columns.map((col) => ({
      index: col.index,
      header: col.header,
      include: true,
      type: "text",
      role: roles[col.header] ?? "dimension",
      unitCode: null,
      dateOrder: "DMY",
    })),
    currency: "USD",
    authoritativeAmount: "total",
    defaultTransactionType: "sale",
    ...overrides,
  };
}

describe("normalizeRows", () => {
  it("normalizes a typical sheet and derives the missing total", () => {
    const s = sheet([
      column("Date", ["16/07/2026", "01/06/2026"]),
      column("Product", ["Honey 500g", "Wool"]),
      column("Qty", [3, "2,500"]),
      column("Price", ["$10.00", 2]),
    ]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { Date: "period", Product: "entity_name", Qty: "quantity", Price: "unit_price" }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-07-16",
      productName: "Honey 500g",
      qty: "3",
      unitPrice: "10",
      total: "30",
    });
    expect(rows[1].qty).toBe("2500"); // thousand separators stripped
    expect(rows[1].total).toBe("5000");
  });

  it("derives unit price from total / qty", () => {
    const s = sheet([column("Qty", [4]), column("Total", [30])]);
    const rows = normalizeRows(s, mappingFor(s, { Qty: "quantity", Total: "total_amount" }));
    expect(rows[0].unitPrice).toBe("7.5");
  });

  it("recomputes total when unit_price is authoritative", () => {
    const s = sheet([column("Qty", [2]), column("Price", [10]), column("Total", [999])]);
    const rows = normalizeRows(
      s,
      mappingFor(
        s,
        { Qty: "quantity", Price: "unit_price", Total: "total_amount" },
        { authoritativeAmount: "unit_price" },
      ),
    );
    expect(rows[0].total).toBe("20");
  });

  it("keeps the stated total when it is authoritative", () => {
    const s = sheet([column("Qty", [2]), column("Price", [10]), column("Total", [999])]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { Qty: "quantity", Price: "unit_price", Total: "total_amount" }),
    );
    expect(rows[0].total).toBe("999");
  });

  it("maps transaction types incl. Arabic and reports unknowns", () => {
    const s = sheet([
      column("Type", ["sale", "بيع", "gifted"]),
      column("Product", ["a", "b", "c"]),
    ]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { Type: "transaction_type", Product: "entity_name" }),
    );
    expect(rows[0].type).toBe("sale");
    expect(rows[1].type).toBe("sale");
    expect(rows[2].type).toBeNull();
    expect(rows[2].problems[0]).toContain("gifted");
  });

  it("records coercion problems without dropping rows", () => {
    const s = sheet([
      column("Product", ["a"]),
      column("Qty", ["a dozen-ish"]),
    ]);
    const rows = normalizeRows(s, mappingFor(s, { Product: "entity_name", Qty: "quantity" }));
    expect(rows[0].qty).toBeNull();
    expect(rows[0].problems[0]).toContain("not a number");
  });

  it("respects the ignore toggle and keeps extras", () => {
    const s = sheet([
      column("Product", ["a"]),
      column("Ignore me", ["x"]),
      column("Region", ["North"]),
    ]);
    const mapping = mappingFor(s, { Product: "entity_name" });
    mapping.columns[1].include = false;
    const rows = normalizeRows(s, mapping);
    expect(rows[0].extras).toEqual({ Region: "North" });
  });
});

describe("normalizeRows — Arabic ledger patterns", () => {
  it("extracts the قسم column as categoryName", () => {
    const s = sheet([
      column("القسم", ["نحل", "غنم"]),
      column("البيان", ["شراء خلايا", "طبابة"]),
      column("المبلغ ($)", [1235, 765]),
    ]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { "القسم": "entity_type", "البيان": "entity_name", "المبلغ ($)": "total_amount" }),
    );
    expect(rows[0]).toMatchObject({
      categoryName: "نحل",
      productName: "شراء خلايا",
      total: "1235",
    });
    expect(rows[1].categoryName).toBe("غنم");
  });

  it("parses quantities embedded in item names — عدد N and N كغ", () => {
    const s = sheet([
      column("البيان", ["غنم عدد 6", "جبنة 33كغ", "قريشة 130 كغ", "سمنة"]),
      column("المبلغ", [864, 100, 295, 13]),
    ]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { "البيان": "entity_name", "المبلغ": "total_amount" }),
    );
    expect(rows[0]).toMatchObject({ productName: "غنم", qty: "6", unitCode: "head" });
    expect(rows[1]).toMatchObject({ productName: "جبنة", qty: "33", unitCode: "kg" });
    expect(rows[2]).toMatchObject({ productName: "قريشة", qty: "130", unitCode: "kg" });
    expect(rows[3]).toMatchObject({ productName: "سمنة", qty: null, unitCode: null });
  });

  it("prefers an explicit quantity column over name parsing", () => {
    const s = sheet([
      column("البيان", ["غنم عدد 6"]),
      column("العدد", [4]),
      column("المبلغ", [864]),
    ]);
    const rows = normalizeRows(
      s,
      mappingFor(s, { "البيان": "entity_name", "العدد": "quantity", "المبلغ": "total_amount" }),
    );
    expect(rows[0].qty).toBe("4");
    expect(rows[0].productName).toBe("غنم عدد 6");
  });
});

describe("computeQuality", () => {
  it("finds duplicates, anomalies, blanks, range and outliers", () => {
    // 14 rows: a single extreme among n values can only exceed 3σ when
    // n ≥ 11 (max deviation/σ = √(n−1)), hence the longer fixture.
    const n = 14;
    const qty = [...Array.from({ length: n - 1 }, (_, i) => (i % 3 === 2 ? 3 : 2)), 400];
    const price = Array.from({ length: n }, () => 5);
    const total = qty.map((q) => q * 5);
    total[8] = 99; // arithmetic anomaly: 2×5 ≠ 99
    const dates = [...Array.from({ length: n - 1 }, () => "05/03/2026"), "09/03/2026"];
    const notes = Array.from({ length: n }, (_, i) => (i === 2 ? "x" : null));
    const s = sheet([
      column("Date", dates),
      column("Product", Array.from({ length: n }, () => "Honey")),
      column("Qty", qty),
      column("Price", price),
      column("Total", total),
      column("Notes", notes),
    ]);
    const mapping = mappingFor(s, {
      Date: "period",
      Product: "entity_name",
      Qty: "quantity",
      Price: "unit_price",
      Total: "total_amount",
      Notes: "notes",
    });
    const rows = normalizeRows(s, mapping);
    const quality = computeQuality(s, mapping, rows);

    expect(quality.rowCount).toBe(n);
    // e.g. rows 1, 3, 4… repeat row 0's core fields exactly
    expect(quality.duplicateRows.length).toBeGreaterThan(0);
    expect(quality.arithmeticAnomalies).toEqual([8]);
    expect(quality.dateRange).toEqual({ min: "2026-03-05", max: "2026-03-09" });
    expect(quality.blanksPerColumn.find((b) => b.header === "Notes")?.blanks).toBe(n - 1);
    expect(quality.outliers.some((o) => o.rowIndexes.includes(n - 1))).toBe(true);
  });
});

describe("headerSignature", () => {
  it("is order-insensitive and case/spacing-insensitive", async () => {
    const a = await headerSignature(["Date", "Product", "Qty"]);
    const b = await headerSignature(["qty", "  DATE ", "product"]);
    const c = await headerSignature(["Date", "Product", "Total"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("parseSheet real-world mess", () => {
  it("detects the header under a merged title row and forward-fills merges", () => {
    const aoa = [
      ["Green Valley Farm — Sales Report", null, null, null],
      [null, null, null, null],
      ["Date", "Product", "Qty", "Total"],
      ["2026-01-05", "Honey", 2, 26],
      ["2026-01-06", "Milk", 10, 13],
      [null, "Milk", 5, 6.5], // merged date cell would cover this in real files
      [null, null, null, null],
      [null, null, null, null],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // title row
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // date covers two rows
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    const reread = readWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const parsed = parseSheet(reread, "Sales");

    expect(parsed.headerRowIndex).toBe(2);
    expect(parsed.columns.map((c) => c.header)).toEqual(["Date", "Product", "Qty", "Total"]);
    expect(parsed.rowCount).toBe(3); // trailing blank rows dropped
    // forward-filled merged date:
    expect(parsed.columns[0].cells[2].v).toEqual(parsed.columns[0].cells[1].v);
  });

  it("detectHeaderRow prefers a unique string row over data rows", () => {
    const grid = [
      [{ v: "Report", isEmpty: false }, { v: null, isEmpty: true }],
      [{ v: "Name", isEmpty: false }, { v: "Amount", isEmpty: false }],
      [{ v: "Honey", isEmpty: false }, { v: 12, isEmpty: false }],
      [{ v: "Wool", isEmpty: false }, { v: 20, isEmpty: false }],
    ];
    expect(detectHeaderRow(grid)).toBe(1);
  });
});
