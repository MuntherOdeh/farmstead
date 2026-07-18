import { describe, expect, it } from "vitest";
import { generateWidgets, isSubtotalRow } from "../widgets";
import type { ImportMapping, NormalizedRow } from "@/lib/import/types";

function row(partial: Partial<NormalizedRow> & { rowIndex: number }): NormalizedRow {
  return {
    date: null,
    productName: null,
    categoryName: null,
    qty: null,
    unitCode: null,
    unitPrice: null,
    total: null,
    party: null,
    type: null,
    notes: null,
    extras: {},
    problems: [],
    ...partial,
  };
}

const mapping: ImportMapping = {
  columns: [
    { index: 0, header: "Date", include: true, type: "date", role: "period", unitCode: null, dateOrder: "DMY" },
    { index: 1, header: "Product", include: true, type: "text", role: "entity_name", unitCode: null, dateOrder: "DMY" },
    { index: 2, header: "Qty", include: true, type: "integer", role: "quantity", unitCode: null, dateOrder: "DMY" },
    { index: 3, header: "Total", include: true, type: "decimal", role: "total_amount", unitCode: null, dateOrder: "DMY" },
  ],
  currency: "USD",
  authoritativeAmount: "total",
  defaultTransactionType: "sale",
};

const products = ["Honey", "Milk", "Wool", "Cheese"];
const rows: NormalizedRow[] = Array.from({ length: 40 }, (_, i) =>
  row({
    rowIndex: i,
    date: `2026-0${(i % 4) + 1}-1${i % 3}`,
    productName: products[i % 4],
    qty: String((i % 5) + 1),
    total: String(((i % 5) + 1) * 10),
  }),
);

describe("isSubtotalRow", () => {
  it("matches Arabic and English subtotal labels", () => {
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "الإجمالي" }))).toBe(true);
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "مدفوع" }))).toBe(true);
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "غير مدفوع" }))).toBe(true);
    expect(isSubtotalRow(row({ rowIndex: 0, categoryName: "إجمالي المصاريف" }))).toBe(true);
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "Total" }))).toBe(true);
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "عجل عدد 5" }))).toBe(false);
    expect(isSubtotalRow(row({ rowIndex: 0, productName: "غنم" }))).toBe(false);
  });
});

describe("subtotal rows are excluded from aggregation (no double-counting)", () => {
  const salesMapping: ImportMapping = {
    columns: [
      { index: 0, header: "البيان", include: true, type: "text", role: "entity_name", unitCode: null, dateOrder: "DMY" },
      { index: 1, header: "المبلغ", include: true, type: "decimal", role: "total_amount", unitCode: null, dateOrder: "DMY" },
    ],
    currency: "USD",
    authoritativeAmount: "total",
    defaultTransactionType: "sale",
  };
  const salesRows: NormalizedRow[] = [
    row({ rowIndex: 0, productName: "غنم عدد 6", total: "864" }),
    row({ rowIndex: 1, productName: "عجل عدد 5", total: "10155" }),
    row({ rowIndex: 2, productName: "جبنة 33كغ", total: "100" }),
    row({ rowIndex: 3, productName: "قريشة 130 كغ", total: "295" }),
    row({ rowIndex: 4, productName: "مدفوع", total: "13229" }),
    row({ rowIndex: 5, productName: "غير مدفوع", total: "517" }),
    row({ rowIndex: 6, productName: "الإجمالي", total: "13746.25" }),
  ];

  it("KPI total sums only the real items, not the subtotals", () => {
    const widgets = generateWidgets(salesMapping, salesRows);
    const kpi = widgets.find((w) => w.kind === "kpi");
    // 864 + 10155 + 100 + 295 = 11414, NOT + 13229 + 517 + 13746.25
    expect(Number(kpi!.kpi!.value)).toBeCloseTo(11414, 0);
    expect(kpi!.kpi!.count).toBe(4);
  });
});

describe("category (entity_type) is the preferred grouping dimension", () => {
  const expMapping: ImportMapping = {
    columns: [
      { index: 0, header: "القسم", include: true, type: "text", role: "entity_type", unitCode: null, dateOrder: "DMY" },
      { index: 1, header: "البيان", include: true, type: "text", role: "entity_name", unitCode: null, dateOrder: "DMY" },
      { index: 2, header: "المبلغ", include: true, type: "decimal", role: "total_amount", unitCode: null, dateOrder: "DMY" },
    ],
    currency: "USD",
    authoritativeAmount: "total",
    defaultTransactionType: "expense",
  };
  const expRows: NormalizedRow[] = [
    row({ rowIndex: 0, categoryName: "غنم", productName: "شراء", total: "22300" }),
    row({ rowIndex: 1, categoryName: "غنم", productName: "شراء", total: "2980" }),
    row({ rowIndex: 2, categoryName: "نحل", productName: "غذاء", total: "25" }),
    row({ rowIndex: 3, categoryName: "بقر", productName: "علف", total: "1560" }),
  ];

  it("builds a 'by القسم' widget grouping on the section, not the repeated البيان", () => {
    const widgets = generateWidgets(expMapping, expRows);
    const byCategory = widgets.find((w) => w.id === "dim:categoryName:total");
    expect(byCategory).toBeDefined();
    const sheep = byCategory!.data.find((d) => d.label === "غنم");
    expect(sheep!.total).toBe(25280);
  });
});

describe("generateWidgets", () => {
  const widgets = generateWidgets(mapping, rows);

  it("produces ranked widgets with subtitles and sources", () => {
    expect(widgets.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < widgets.length; i++) {
      expect(widgets[i - 1].score).toBeGreaterThanOrEqual(widgets[i].score);
    }
    for (const widget of widgets) {
      expect(widget.subtitle.length).toBeGreaterThan(10);
      expect(widget.sourceColumns.length).toBeGreaterThan(0);
    }
  });

  it("builds a monthly time series for period + measure", () => {
    const ts = widgets.find((w) => w.id === "timeseries:total");
    expect(ts).toBeDefined();
    expect(ts!.data.map((d) => d.label)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("uses a donut for ≤6 distinct categories", () => {
    const donut = widgets.find((w) => w.id === "dim:productName:total");
    expect(donut).toBeDefined();
    expect(donut!.kind).toBe("donut");
    expect(donut!.data).toHaveLength(4);
  });

  it("collapses >8 categories to top 10 + Other", () => {
    const manyProducts = Array.from({ length: 60 }, (_, i) =>
      row({
        rowIndex: i,
        productName: `P${i % 14}`,
        qty: "1",
        total: String(100 - (i % 14)),
      }),
    );
    const many = generateWidgets(mapping, manyProducts);
    const bar = many.find((w) => w.id === "dim:productName:total");
    expect(bar).toBeDefined();
    expect(bar!.kind).toBe("ranked-bar");
    expect(bar!.data.at(-1)!.label).toBe("Other");
    expect(bar!.data).toHaveLength(11);
  });

  it("makes scatter for measure × measure and KPI with histogram bins", () => {
    expect(widgets.find((w) => w.kind === "scatter")).toBeDefined();
    const kpi = widgets.find((w) => w.id === "kpi:total");
    expect(kpi).toBeDefined();
    expect(kpi!.kpi!.count).toBe(40);
    expect(Number(kpi!.kpi!.value)).toBeGreaterThan(0);
    expect(kpi!.data.length).toBeGreaterThanOrEqual(5);
  });

  it("links every label back to underlying row indexes", () => {
    const donut = widgets.find((w) => w.id === "dim:productName:total")!;
    expect(donut.rowsByLabel["Honey"].length).toBe(10);
  });
});
