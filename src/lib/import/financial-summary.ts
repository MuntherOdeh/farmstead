// Structure-aware reader for the owner's Arabic financial-summary sheets
// (Balance_sheet_trial.xlsx — "ملخص"). The sheet stacks several tables in one
// grid: expenses by section, a sales block, receipts/other expenses, a colour
// legend, and numbered notes. When an import's raw rows match this shape the
// /data page renders a dedicated financial view instead of generic widgets.

export interface ExpenseSection {
  label: string;
  amount: number;
  sharePct: number; // 0–100
  itemCount: number;
  /** The hand-written total from the original file, when present. */
  original: number | null;
  /** amount − original; non-zero means the file disagrees with itself. */
  diff: number | null;
}

export interface SalesRow {
  label: string;
  amountLira: number;
  usdEquivalent: number | null;
}

export interface ReceiptRow {
  label: string;
  amount: number;
  currency: string;
  usdEquivalent: number | null;
}

export interface FinancialSummary {
  sections: ExpenseSection[];
  total: ExpenseSection | null;
  expensesFootnote: string | null;
  sales: SalesRow[];
  receipts: ReceiptRow[];
  legend: string[];
  notes: string[];
}

const KEY_SECTION = "القسم";
const KEY_AMOUNT = "المبلغ ($)";
const KEY_SHARE = "النسبة";
const KEY_COUNT = "عدد البنود";
const KEY_ORIGINAL = "الأصل";

type RawRow = Record<string, unknown>;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/** "٢. المبيعات" style block headings (Arabic-Indic or Western numerals). */
const isNumberedHeading = (value: string) => /^[٠-٩0-9]+\s*[.،]/.test(value);

export function parseFinancialSummary(rawRows: RawRow[]): FinancialSummary | null {
  if (rawRows.length === 0) return null;
  const keys = new Set(rawRows.flatMap((row) => Object.keys(row)));
  if (!keys.has(KEY_SECTION) || !keys.has(KEY_AMOUNT) || !keys.has(KEY_SHARE) || !keys.has(KEY_COUNT)) {
    return null;
  }

  const summary: FinancialSummary = {
    sections: [],
    total: null,
    expensesFootnote: null,
    sales: [],
    receipts: [],
    legend: [],
    notes: [],
  };

  type Block = "expenses" | "sales" | "receipts" | "legend" | "notes";
  let block: Block = "expenses";

  for (const row of rawRows) {
    const label = text(row[KEY_SECTION]);
    const amount = num(row[KEY_AMOUNT]);
    const share = num(row[KEY_SHARE]);
    const count = num(row[KEY_COUNT]);
    const original = num(row[KEY_ORIGINAL]);

    // Note rows repeat the same long text across every column.
    const values = [row[KEY_SECTION], row[KEY_AMOUNT], row[KEY_SHARE], row[KEY_COUNT]];
    const distinctTexts = new Set(values.filter((v) => typeof v === "string"));
    if (
      block === "notes" &&
      label !== null &&
      distinctTexts.size === 1 &&
      values.every((v) => typeof v === "string" || v === null || v === undefined)
    ) {
      summary.notes.push(label);
      continue;
    }

    if (label === null) continue;

    // Block transitions.
    if (label.includes("المبيعات") && isNumberedHeading(label)) {
      block = "sales";
      continue;
    }
    if (label.includes("المقبوضات") && isNumberedHeading(label)) {
      block = "receipts";
      continue;
    }
    if (label.includes("دليل الألوان")) {
      block = "legend";
      continue;
    }
    if (label.includes("ملاحظات")) {
      block = "notes";
      continue;
    }

    switch (block) {
      case "expenses": {
        if (amount !== null && share !== null && count !== null) {
          const section: ExpenseSection = {
            label,
            amount,
            sharePct: share * 100,
            itemCount: count,
            original,
            diff: original !== null ? amount - original : null,
          };
          if (label.includes("إجمالي")) summary.total = section;
          else summary.sections.push(section);
        } else if (amount === null && share === null && summary.total !== null) {
          // Footnote line directly under the expenses table.
          summary.expensesFootnote = label;
        }
        break;
      }
      case "sales": {
        if (label === "البند") break; // sub-table header
        if (amount !== null) {
          summary.sales.push({ label, amountLira: amount, usdEquivalent: share });
        }
        break;
      }
      case "receipts": {
        if (label === "البند") break;
        if (amount !== null) {
          summary.receipts.push({
            label,
            amount,
            currency: text(row[KEY_COUNT]) ?? "$",
            usdEquivalent: share,
          });
        }
        break;
      }
      case "legend": {
        summary.legend.push(label);
        break;
      }
      case "notes":
        // handled above (repeated-text rows); stray labels are notes too
        summary.notes.push(label);
        break;
    }
  }

  // Only claim the structure when the core table actually materialised.
  if (summary.sections.length < 3 || summary.total === null) return null;
  return summary;
}
