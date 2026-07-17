// Structure-aware reader for the owner's Arabic financial-summary sheets
// ("ملخص" in Balance_sheet_trial.xlsx / Trial 2.xlsx). The sheet stacks
// several tables in one grid: expenses by section, then any number of money
// tables (sales in lira, invested amounts, receipts…) each introduced by a
// title line and a "البند" sub-header, plus an optional colour legend and
// numbered notes. Titles are read from the sheet itself, so renamed or added
// blocks keep working.

export interface ExpenseSection {
  label: string;
  amount: number;
  sharePct: number; // 0–100
  itemCount: number;
  /** Hand-written total from the original file, when that column exists. */
  original: number | null;
  /** amount − original; non-zero means the file disagrees with itself. */
  diff: number | null;
}

export interface MoneyRow {
  label: string;
  amount: number;
  /** Currency text when the table has a العملة column (e.g. "$", "ليرة"). */
  currency: string | null;
  usdEquivalent: number | null;
  isTotal: boolean;
}

export interface MoneyTable {
  title: string;
  hasCurrency: boolean;
  rows: MoneyRow[];
}

export interface FinancialSummary {
  sections: ExpenseSection[];
  total: ExpenseSection | null;
  expensesFootnote: string | null;
  tables: MoneyTable[];
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

/** Strip a leading "٢." / "3-" style numbering from a block title. */
const cleanTitle = (value: string) =>
  value.replace(/^[٠-٩0-9]+\s*[.،-]\s*/, "").trim();

const isTotalLabel = (value: string) => /إجمالي|الإجمالي|المجموع/.test(value);

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
    tables: [],
    legend: [],
    notes: [],
  };

  type Block = "expenses" | "table" | "legend" | "notes";
  let block: Block = "expenses";
  let currentTable: MoneyTable | null = null;
  let pendingTitle: string | null = null;

  for (const row of rawRows) {
    const label = text(row[KEY_SECTION]);
    const amount = num(row[KEY_AMOUNT]);
    const share = num(row[KEY_SHARE]);
    const count = num(row[KEY_COUNT]);
    const original = num(row[KEY_ORIGINAL]);

    // Note rows repeat one long text across every column — collapse to one.
    const values = [row[KEY_SECTION], row[KEY_AMOUNT], row[KEY_SHARE], row[KEY_COUNT]];
    const distinctTexts = new Set(values.filter((v) => typeof v === "string"));
    const allTextual = values.every(
      (v) => typeof v === "string" || v === null || v === undefined,
    );
    if (block === "notes" && label !== null && distinctTexts.size === 1 && allTextual) {
      summary.notes.push(label);
      continue;
    }

    if (label === null) continue;

    // "البند" sub-header opens a money table; العملة column decides its shape.
    if (label === "البند") {
      currentTable = {
        title: pendingTitle ?? "جدول مالي",
        hasCurrency: text(row[KEY_COUNT]) === "العملة",
        rows: [],
      };
      summary.tables.push(currentTable);
      pendingTitle = null;
      block = "table";
      continue;
    }

    // Text-only line (all numeric columns empty).
    if (amount === null && share === null && count === null) {
      // Keyword blocks — only short heading-like lines switch blocks, so a
      // long footnote that merely MENTIONS "الملاحظات" doesn't hijack parsing.
      if (label.length <= 40 && label.includes("دليل الألوان")) {
        block = "legend";
      } else if (label.length <= 40 && label.includes("ملاحظات")) {
        block = "notes";
      } else if (block === "legend") {
        summary.legend.push(label);
      } else if (block === "notes") {
        summary.notes.push(label);
      } else if (label.length <= 60) {
        // Short line → the title of whatever table comes next.
        pendingTitle = cleanTitle(label);
      } else if (block === "expenses" && summary.total !== null) {
        summary.expensesFootnote = label;
      }
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
          if (isTotalLabel(label)) summary.total = section;
          else summary.sections.push(section);
        }
        break;
      }
      case "table": {
        if (currentTable && amount !== null) {
          currentTable.rows.push({
            label,
            amount,
            currency: currentTable.hasCurrency ? text(row[KEY_COUNT]) : null,
            usdEquivalent: share,
            isTotal: isTotalLabel(label),
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Only claim the structure when the core table actually materialised.
  if (summary.sections.length < 3 || summary.total === null) return null;
  return summary;
}
