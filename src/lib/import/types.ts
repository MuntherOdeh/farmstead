// Shared types for the import pipeline (SPEC §5).
// parse → infer → review → validate → commit → dashboard

export type PhysicalType =
  | "empty"
  | "boolean"
  | "integer"
  | "decimal"
  | "currency"
  | "percent"
  | "date"
  | "duration"
  | "category"
  | "text"
  | "id";

export type SemanticRole =
  | "period"
  | "entity_type"
  | "entity_name"
  | "quantity"
  | "unit"
  | "unit_price"
  | "total_amount"
  | "cost"
  | "party"
  | "location"
  | "transaction_type"
  | "weight"
  | "breed"
  | "sex"
  | "age"
  | "tag_id"
  | "notes"
  | "dimension"
  | "measure";

/** A parsed cell: the raw value plus Excel metadata used as type evidence. */
export interface ParsedCell {
  /** Coerced JS value (Dates already honour the workbook 1900/1904 epoch). */
  v: string | number | boolean | Date | null;
  /** Excel number format string (e.g. "$#,##0.00", "0.0%", "dd/mm/yyyy"). */
  z?: string;
  /** The text as Excel displayed it. */
  w?: string;
}

export interface ParsedColumn {
  index: number;
  header: string;
  cells: ParsedCell[];
}

export interface ParsedSheet {
  name: string;
  headerRowIndex: number;
  columns: ParsedColumn[];
  rowCount: number;
}

export interface InferredColumn {
  index: number;
  header: string;
  physicalType: PhysicalType;
  typeConfidence: number; // 0..1
  role: SemanticRole;
  roleConfidence: number; // 0..1
  unitCode: string | null;
  currency: string | null;
  /** String dates that parse as both D/M and M/D — must be confirmed. */
  ambiguousDate: boolean;
  distinctCount: number;
  blankCount: number;
  samples: string[]; // up to 3 display samples
  /** Units seen mixed inside one column (e.g. kg and lb). */
  mixedUnits: string[] | null;
}

export interface CrossChecks {
  /** qty × unit_price ≈ total on ≥90% of rows. */
  qtyPriceTotal: {
    qtyIndex: number;
    priceIndex: number;
    totalIndex: number;
    matchRate: number;
    anomalyRows: number[];
  } | null;
  /** total exists but no unit_price → derive unit_price = total / qty. */
  deriveUnitPrice: boolean;
  detectedCurrency: string | null;
}

export interface InferredSchema {
  columns: InferredColumn[];
  crossChecks: CrossChecks;
}

export interface ColumnMapping {
  index: number;
  header: string;
  include: boolean;
  type: PhysicalType;
  role: SemanticRole;
  unitCode: string | null;
  /** For ambiguous string dates. */
  dateOrder: "DMY" | "MDY";
}

export type DefaultTxType =
  | "sale"
  | "purchase"
  | "birth"
  | "death"
  | "consumption"
  | "adjustment"
  | "expense";

export interface ImportMapping {
  columns: ColumnMapping[];
  currency: string;
  /** When qty×price disagrees with total, which column wins. */
  authoritativeAmount: "total" | "unit_price";
  defaultTransactionType: DefaultTxType;
}

export interface NormalizedRow {
  rowIndex: number;
  date: string | null; // yyyy-MM-dd
  productName: string | null;
  /** From an entity_type (قسم/category) column — drives category assignment. */
  categoryName: string | null;
  qty: string | null; // decimal string
  unitCode: string | null;
  unitPrice: string | null; // decimal string
  total: string | null; // decimal string
  party: string | null;
  type: DefaultTxType | null;
  notes: string | null;
  extras: Record<string, string | number | boolean | null>;
  /** Per-row coercion problems, e.g. "qty: 'abc' is not a number". */
  problems: string[];
}

export interface QualityReport {
  rowCount: number;
  blanksPerColumn: { header: string; blanks: number }[];
  duplicateRows: number[]; // rowIndexes of the 2nd+ occurrence
  coercionFailures: number[]; // rowIndexes with problems
  arithmeticAnomalies: number[]; // rowIndexes where qty×price differs >1% from total
  dateRange: { min: string; max: string } | null;
  currencies: string[];
  outliers: { header: string; rowIndexes: number[] }[]; // > 3σ
}
