import { describe, expect, it } from "vitest";
import { parseFinancialSummary } from "../financial-summary";

// Fixture: the exact shape of the owner's Balance_sheet_trial.xlsx "ملخص"
// sheet as stored in import_rows.raw (abbreviated but structurally faithful).
const K = {
  s: "القسم",
  a: "المبلغ ($)",
  p: "النسبة",
  c: "عدد البنود",
  o: "الأصل",
};

const noteText =
  '١. "بقر": الإجمالي المكتوب في الأصل 7,608 لم يطرح مبيع العجول.';

const rows: Record<string, unknown>[] = [
  { [K.s]: "نحل", [K.a]: 2120, [K.p]: 0.0140780535, [K.c]: 6, [K.o]: 2119 },
  { [K.s]: "غنم", [K.a]: 28845, [K.p]: 0.1915478554, [K.c]: 10, [K.o]: 28857 },
  { [K.s]: "بقر", [K.a]: 7660, [K.p]: 0.0508669292, [K.c]: 4, [K.o]: 7608 },
  { [K.s]: "أرض", [K.a]: 56000, [K.p]: 0.3718731116, [K.c]: 5, [K.o]: 56000 },
  { [K.s]: "إجمالي المصاريف", [K.a]: 150589, [K.p]: 1, [K.c]: 83, [K.o]: 150400 },
  { [K.s]: 'عمود "الأصل" = الإجمالي المكتوب يدوياً في الملف الأصلي.', [K.a]: null, [K.p]: null, [K.c]: null, [K.o]: null },
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

describe("parseFinancialSummary", () => {
  const summary = parseFinancialSummary(rows)!;

  it("recognises the structure", () => {
    expect(summary).not.toBeNull();
  });

  it("reads expense sections with share %, counts and original-vs-computed diff", () => {
    expect(summary.sections.map((s) => s.label)).toEqual(["نحل", "غنم", "بقر", "أرض"]);
    const cows = summary.sections.find((s) => s.label === "بقر")!;
    expect(cows.amount).toBe(7660);
    expect(cows.original).toBe(7608);
    expect(cows.diff).toBe(52);
    expect(cows.sharePct).toBeCloseTo(5.09, 1);
    expect(cows.itemCount).toBe(4);
  });

  it("captures the total row and the footnote under it", () => {
    expect(summary.total?.amount).toBe(150589);
    expect(summary.total?.original).toBe(150400);
    expect(summary.total?.diff).toBe(189);
    expect(summary.expensesFootnote).toContain('عمود "الأصل"');
  });

  it("reads the sales block without its sub-header", () => {
    expect(summary.sales.map((s) => s.label)).toEqual(["مدفوع", "غير مدفوع", "إجمالي المبيعات"]);
    expect(summary.sales[0].amountLira).toBe(13229);
    expect(summary.sales[0].usdEquivalent).toBeCloseTo(1.0022, 3);
  });

  it("reads receipts with currencies", () => {
    expect(summary.receipts).toHaveLength(2);
    expect(summary.receipts[0]).toMatchObject({ label: "مدفوعات مظهر (إجمالي)", amount: 69800, currency: "$" });
    expect(summary.receipts[1].currency).toBe("ليرة");
  });

  it("collects legend lines and dedupes repeated-text note rows", () => {
    expect(summary.legend[0]).toContain("أزرق");
    expect(summary.notes).toEqual([noteText]);
  });

  it("returns null for ordinary sales ledgers", () => {
    expect(
      parseFinancialSummary([{ Date: "2026-01-01", Product: "Honey", Qty: 2, Total: 26 }]),
    ).toBeNull();
  });
});
