import type { ImportMapping } from "./types";

// One-click ingestion for the owner's farm-ledger workbooks (SPEC intent:
// "eat any Excel file" — this recognises the recurring workbook shape by its
// sheet names and knows what each sheet MEANS, so the whole file imports with
// a single confirmation and zero per-sheet decisions).

export type SheetMode = "expenses" | "sales" | "land" | "summary" | "reference";

export interface SheetPlan {
  sheetName: string;
  mode: SheetMode;
  /** What the user sees on the confirmation card. */
  label: string;
  referenceOnly: boolean;
  defaultType: ImportMapping["defaultTransactionType"];
}

export function planForSheet(sheetName: string): SheetPlan {
  const name = sheetName.trim();
  if (/مصاريف|مصروف|expense/i.test(name)) {
    return {
      sheetName,
      mode: "expenses",
      label: "مصاريف — كل بند يصبح حركة مصروف ضمن قسمه",
      referenceOnly: false,
      defaultType: "expense",
    };
  }
  if (/مبيعات|مبيع|sales/i.test(name)) {
    return {
      sheetName,
      mode: "sales",
      label: "مبيعات — كل بند يصبح عملية بيع (مع الكمية من الاسم)",
      referenceOnly: false,
      defaultType: "sale",
    };
  }
  if (/أرض|ارض|land/i.test(name)) {
    return {
      sheetName,
      mode: "land",
      label: "أرض — المدفوع لكل قطعة يصبح عملية شراء",
      referenceOnly: false,
      defaultType: "purchase",
    };
  }
  if (/ملخص|summary/i.test(name)) {
    return {
      sheetName,
      mode: "summary",
      label: "ملخص — يُعرض كصفحة مالية خاصة، بلا حركات",
      referenceOnly: true,
      defaultType: "sale",
    };
  }
  return {
    sheetName,
    mode: "reference",
    label: "بيانات مرجعية — تُحفظ مع لوحة خاصة بها، بلا حركات",
    referenceOnly: true,
    defaultType: "sale",
  };
}

/** The workbook is "ours" when its sheets include at least two known farm
 *  sheets and at least one that creates ledger rows. */
export function detectFarmWorkbook(sheetNames: string[]): boolean {
  const plans = sheetNames.map(planForSheet);
  const known = plans.filter((plan) => plan.mode !== "reference");
  const flows = plans.filter((plan) => !plan.referenceOnly);
  return known.length >= 2 && flows.length >= 1;
}

/** Adjust the inferred mapping to the sheet's meaning. */
export function applyPlanToMapping(mapping: ImportMapping, plan: SheetPlan): ImportMapping {
  const columns = mapping.columns.map((column) => ({ ...column }));

  if (plan.mode === "land") {
    // The money that already left the farm is المدفوع — that is the
    // transaction amount. Full price and remaining stay as reference figures.
    for (const column of columns) {
      if (/المدفوع/.test(column.header)) column.role = "total_amount";
      else if (/المتبقي|الكامل/.test(column.header) && column.role !== "entity_name") {
        column.role = "measure";
      } else if (column.role === "unit_price" || column.role === "total_amount") {
        column.role = "measure";
      }
    }
  }
  if (plan.mode === "sales" || plan.mode === "expenses") {
    // Only one money column should be the total; drop stray duplicate roles.
    let seenTotal = false;
    for (const column of columns) {
      if (column.role === "total_amount") {
        if (seenTotal) column.role = "measure";
        seenTotal = true;
      }
    }
  }

  return {
    ...mapping,
    columns,
    defaultTransactionType: plan.defaultType,
  };
}
