import { describe, expect, it } from "vitest";
import { inferPhysicalType, inferRole, inferSchema } from "../infer";
import { column, sheet } from "./helpers";

describe("inferPhysicalType", () => {
  it("detects integers and decimals", () => {
    expect(inferPhysicalType(column("q", [1, 2, 3, 40]).cells).type).toBe("integer");
    expect(inferPhysicalType(column("p", [1.5, 2.25, 3.1]).cells).type).toBe("decimal");
  });

  it("uses the Excel number format as currency evidence", () => {
    const cells = column("amount", [
      { v: 120, z: "$#,##0.00" },
      { v: 89.5, z: "$#,##0.00" },
      { v: 40, z: "$#,##0.00" },
    ]).cells;
    const result = inferPhysicalType(cells);
    expect(result.type).toBe("currency");
    expect(result.confidence).toBe(1);
  });

  it("detects percent from format and from strings", () => {
    expect(inferPhysicalType(column("m", [{ v: 0.15, z: "0.0%" }, { v: 0.2, z: "0.0%" }]).cells).type).toBe("percent");
    expect(inferPhysicalType(column("m", ["15%", "22%", "8%"]).cells).type).toBe("percent");
  });

  it("detects currency strings with symbols", () => {
    expect(inferPhysicalType(column("t", ["$1,200.50", "$89", "$3.10"]).cells).type).toBe("currency");
  });

  it("detects dates from Date objects and strings", () => {
    expect(inferPhysicalType(column("d", [new Date(), new Date()]).cells).type).toBe("date");
    expect(inferPhysicalType(column("d", ["2026-01-05", "2026-02-11"]).cells).type).toBe("date");
  });

  it("flags ambiguous D/M vs M/D string dates", () => {
    const ambiguous = inferPhysicalType(column("d", ["03/04/2026", "05/06/2026"]).cells);
    expect(ambiguous.type).toBe("date");
    expect(ambiguous.ambiguousDate).toBe(true);
    // A day > 12 anywhere pins the order for the whole column.
    const pinned = inferPhysicalType(column("d", ["03/04/2026", "25/06/2026"]).cells);
    expect(pinned.ambiguousDate).toBe(false);
  });

  it("classifies repetitive text as category", () => {
    const values = Array.from({ length: 60 }, (_, i) => ["Sheep", "Goat", "Cow"][i % 3]);
    expect(inferPhysicalType(column("c", values).cells).type).toBe("category");
  });

  it("classifies near-unique codes as id", () => {
    const values = Array.from({ length: 40 }, (_, i) => `TAG-${1000 + i}`);
    expect(inferPhysicalType(column("tag", values).cells).type).toBe("id");
  });

  it("detects booleans in several spellings", () => {
    expect(inferPhysicalType(column("b", ["yes", "no", "yes"]).cells).type).toBe("boolean");
  });
});

describe("inferRole", () => {
  const roleOf = (header: string, values: Array<string | number | Date>) => {
    const col = column(header, values);
    return inferRole(col, inferPhysicalType(col.cells));
  };

  it("matches English headers", () => {
    expect(roleOf("Quantity", [1, 2]).role).toBe("quantity");
    expect(roleOf("Unit Price", [5.5, 4]).role).toBe("unit_price");
    expect(roleOf("Total", [11, 8]).role).toBe("total_amount");
    expect(roleOf("Date", [new Date()]).role).toBe("period");
    expect(roleOf("Customer", ["Haddad"]).role).toBe("party");
  });

  it("matches Arabic headers", () => {
    expect(roleOf("الكمية", [3, 4]).role).toBe("quantity");
    expect(roleOf("السعر", [9.5, 8]).role).toBe("unit_price");
    expect(roleOf("الإجمالي", [100, 50]).role).toBe("total_amount");
    expect(roleOf("التاريخ", [new Date()]).role).toBe("period");
    expect(roleOf("المنتج", ["عسل"]).role).toBe("entity_name");
  });

  it("survives typos via fuzzy matching (Levenshtein ≤ 2)", () => {
    expect(roleOf("Quantitty", [1, 2]).role).toBe("quantity");
    expect(roleOf("Prise", [3.2, 4]).role).toBe("unit_price");
  });

  it("uses value evidence when the header is useless", () => {
    expect(roleOf("Col B", ["kg", "kg", "litre", "kg"]).role).toBe("unit");
    expect(roleOf("X", ["sale", "purchase", "sale"]).role).toBe("transaction_type");
    expect(roleOf("Thing", ["sheep", "honey", "milk", "lamb"]).role).toBe("entity_name");
  });

  it("falls back to measure/dimension", () => {
    expect(roleOf("mystery1", [12.5, 19.25, 3.75]).role).toBe("measure");
    const longText = Array.from({ length: 30 }, (_, i) => `note number ${i} about things`);
    expect(roleOf("mystery2", longText).role).toBe("dimension");
  });
});

describe("inferSchema cross-column checks", () => {
  it("confirms qty × price ≈ total and flags >1% anomalies", () => {
    const qty = [2, 3, 4, 5, 10];
    const price = [10, 20, 5, 8, 3];
    const total = [20, 60, 20, 40, 45]; // last row: 10×3=30 ≠ 45 → anomaly
    const s = sheet([
      column("Product", ["a", "b", "c", "d", "e"]),
      column("Qty", qty),
      column("Price", price),
      column("Total", total),
    ]);
    const schema = inferSchema(s);
    expect(schema.crossChecks.qtyPriceTotal).not.toBeNull();
    expect(schema.crossChecks.qtyPriceTotal!.matchRate).toBeCloseTo(0.8);
    expect(schema.crossChecks.qtyPriceTotal!.anomalyRows).toEqual([4]);
  });

  it("suggests deriving unit price when only totals exist", () => {
    const s = sheet([
      column("Product", ["a", "b"]),
      column("Qty", [2, 4]),
      column("Total", [20, 30]),
    ]);
    expect(inferSchema(s).crossChecks.deriveUnitPrice).toBe(true);
  });

  it("detects the currency from formats", () => {
    const s = sheet([
      column("Total", [
        { v: 100, z: '"$"#,##0.00' },
        { v: 50, z: '"$"#,##0.00' },
      ]),
    ]);
    expect(inferSchema(s).crossChecks.detectedCurrency).toBe("USD");
  });

  it("flags mixed units in one column", () => {
    const s = sheet([
      column("Unit", ["kg", "kg", "lb", "kg"]),
      column("Qty", [1, 2, 3, 4]),
    ]);
    const unitColumn = inferSchema(s).columns.find((c) => c.role === "unit");
    expect(unitColumn?.mixedUnits).toContain("kg");
    expect(unitColumn?.mixedUnits).toContain("lb");
  });

  it("demotes the smaller of two total-ish columns to unit_price", () => {
    const s = sheet([
      column("Amount", [10, 20, 30]),
      column("Value", [1000, 2000, 3000]),
    ]);
    const schema = inferSchema(s);
    const roles = schema.columns.map((c) => c.role);
    expect(roles.filter((role) => role === "total_amount")).toHaveLength(1);
    expect(schema.columns.find((c) => c.header === "Value")?.role).toBe("total_amount");
  });
});
