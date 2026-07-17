import { describe, expect, it } from "vitest";
import { parseFinancialSummary } from "../financial-summary";

// Fixtures mirror the owner's real files as stored in import_rows.raw:
// v1 = Balance_sheet_trial.xlsx "ملخص" (has the الأصل column + notes),
// v2 = Trial 2.xlsx "ملخص" (no الأصل, renamed third block).
const K = {
  s: "القسم",
  a: "المبلغ ($)",
  p: "النسبة",
  c: "عدد البنود",
  o: "الأصل",
};

const noteText =
  '١. "بقر": الإجمالي المكتوب في الأصل 7,608 لم يطرح مبيع العجول.';

const v1: Record<string, unknown>[] = [
  { [K.s]: "نحل", [K.a]: 2120, [K.p]: 0.0140780535, [K.c]: 6, [K.o]: 2119 },
  { [K.s]: "غنم", [K.a]: 28845, [K.p]: 0.1915478554, [K.c]: 10, [K.o]: 28857 },
  { [K.s]: "بقر", [K.a]: 7660, [K.p]: 0.0508669292, [K.c]: 4, [K.o]: 7608 },
  { [K.s]: "أرض", [K.a]: 56000, [K.p]: 0.3718731116, [K.c]: 5, [K.o]: 56000 },
  { [K.s]: "إجمالي المصاريف", [K.a]: 150589, [K.p]: 1, [K.c]: 83, [K.o]: 150400 },
  { [K.s]: 'عمود "الأصل" = الإجمالي المكتوب يدوياً في الملف الأصلي، والفرق الوحيد في "بقر" — انظر الملاحظات أدناه.', [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: "٢. المبيعات", [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: "البند", [K.a]: "المبلغ (ليرة)", [K.p]: "ما يعادله ($)", [K.c]: null, [K.o]: null },
  { [K.s]: "مدفوع", [K.a]: 13229, [K.p]: 1.002197, [K.c]: null, [K.o]: null },
  { [K.s]: "غير مدفوع", [K.a]: 517, [K.p]: 0.0391667, [K.c]: null, [K.o]: null },
  { [K.s]: "إجمالي المبيعات", [K.a]: 13746.25, [K.p]: 1.0413826, [K.c]: null, [K.o]: null },
  { [K.s]: "٣. المقبوضات والمصاريف الأخرى", [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: "البند", [K.a]: "المبلغ", [K.p]: "ما يعادله ($)", [K.c]: "العملة", [K.o]: null },
  { [K.s]: "مدفوعات مظهر (إجمالي)", [K.a]: 69800, [K.p]: 69800, [K.c]: "$", [K.o]: null },
  { [K.s]: "مصاريف أخرى — الإجمالي", [K.a]: 9850000, [K.p]: 746.2121212, [K.c]: "ليرة", [K.o]: null },
  { [K.s]: "دليل الألوان", [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: "أزرق = رقم مُدخل من الملف الأصلي", [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: "ملاحظات ومسائل تحتاج تأكيد", [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
  { [K.s]: noteText, [K.a]: noteText, [K.p]: noteText, [K.c]: noteText, [K.o]: noteText },
];

const v2: Record<string, unknown>[] = [
  { [K.s]: "نحل", [K.a]: 2120, [K.p]: 0.0140780535, [K.c]: 6 },
  { [K.s]: "غنم", [K.a]: 28845, [K.p]: 0.1915478554, [K.c]: 10 },
  { [K.s]: "بقر", [K.a]: 7660, [K.p]: 0.0508669292, [K.c]: 4 },
  { [K.s]: "أرض", [K.a]: 56000, [K.p]: 0.3718731116, [K.c]: 5 },
  { [K.s]: "إجمالي المصاريف", [K.a]: 150589, [K.p]: 1, [K.c]: 83 },
  { [K.s]: "٢. المبيعات", [K.a]: null, [K.p]: null, [K.c]: null },
  { [K.s]: "البند", [K.a]: "المبلغ (ليرة)", [K.p]: "ما يعادله ($)", [K.c]: null },
  { [K.s]: "مدفوع", [K.a]: 13229, [K.p]: 1.002197, [K.c]: null },
  { [K.s]: "إجمالي المبيعات", [K.a]: 13746.25, [K.p]: 1.0413826, [K.c]: null },
  { [K.s]: "المبلغ المستثمر و المعاد استثماره ", [K.a]: null, [K.p]: null, [K.c]: null },
  { [K.s]: "البند", [K.a]: "المبلغ", [K.p]: "ما يعادله ($)", [K.c]: "العملة" },
  { [K.s]: "مدفوعات مظهر (إجمالي)", [K.a]: 69800, [K.p]: 69800, [K.c]: "$" },
  { [K.s]: "مدفوعات وائل (إجمالي)", [K.a]: 70000, [K.p]: 70000, [K.c]: "$" },
  { [K.s]: "مبيعات ", [K.a]: 13746.25, [K.p]: 13746.25, [K.c]: "$" },
  { [K.s]: "الإجمالي ", [K.a]: 153546.25, [K.p]: 153546.25, [K.c]: "$" },
];

describe("parseFinancialSummary — v1 (with الأصل column)", () => {
  const summary = parseFinancialSummary(v1)!;

  it("reads sections with original-vs-computed diffs", () => {
    expect(summary.sections.map((s) => s.label)).toEqual(["نحل", "غنم", "بقر", "أرض"]);
    const cows = summary.sections.find((s) => s.label === "بقر")!;
    expect(cows).toMatchObject({ amount: 7660, original: 7608, diff: 52, itemCount: 4 });
    expect(cows.sharePct).toBeCloseTo(5.09, 1);
    expect(summary.total).toMatchObject({ amount: 150589, original: 150400, diff: 189 });
    expect(summary.expensesFootnote).toContain('عمود "الأصل"');
  });

  it("reads titled money tables from the sheet's own headings", () => {
    expect(summary.tables.map((t) => t.title)).toEqual(["المبيعات", "المقبوضات والمصاريف الأخرى"]);
    const sales = summary.tables[0];
    expect(sales.hasCurrency).toBe(false);
    expect(sales.rows.map((r) => r.label)).toEqual(["مدفوع", "غير مدفوع", "إجمالي المبيعات"]);
    expect(sales.rows[2].isTotal).toBe(true);
    const receipts = summary.tables[1];
    expect(receipts.hasCurrency).toBe(true);
    expect(receipts.rows[1]).toMatchObject({ amount: 9850000, currency: "ليرة" });
  });

  it("collects legend lines and dedupes repeated-text notes", () => {
    expect(summary.legend[0]).toContain("أزرق");
    expect(summary.notes).toEqual([noteText]);
  });
});

describe("parseFinancialSummary — v2 (Trial 2: no الأصل, renamed block)", () => {
  const summary = parseFinancialSummary(v2)!;

  it("parses sections without the original column", () => {
    expect(summary.sections).toHaveLength(4);
    expect(summary.sections[0]).toMatchObject({ label: "نحل", original: null, diff: null });
    expect(summary.total?.amount).toBe(150589);
    expect(summary.expensesFootnote).toBeNull();
  });

  it("picks up the renamed invested-amounts table with its currency rows", () => {
    expect(summary.tables.map((t) => t.title)).toEqual([
      "المبيعات",
      "المبلغ المستثمر و المعاد استثماره",
    ]);
    const invested = summary.tables[1];
    expect(invested.hasCurrency).toBe(true);
    expect(invested.rows).toHaveLength(4);
    expect(invested.rows[3]).toMatchObject({
      label: "الإجمالي",
      amount: 153546.25,
      currency: "$",
      isTotal: true,
    });
  });
});

describe("parseFinancialSummary — rejection", () => {
  it("returns null for ordinary sales ledgers", () => {
    expect(
      parseFinancialSummary([{ Date: "2026-01-01", Product: "Honey", Qty: 2, Total: 26 }]),
    ).toBeNull();
  });
});
