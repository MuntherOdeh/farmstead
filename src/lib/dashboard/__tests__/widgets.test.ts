import { describe, expect, it } from "vitest";
import { generateWidgets } from "../widgets";
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
