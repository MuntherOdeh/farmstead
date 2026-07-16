import Decimal from "decimal.js";
import type { ImportMapping, NormalizedRow, ParsedSheet, QualityReport } from "./types";

// The data quality panel (SPEC §5.3): every number is clickable in the UI and
// jumps to the offending rows, so each check returns row indexes.

export function computeQuality(
  sheet: ParsedSheet,
  mapping: ImportMapping,
  rows: NormalizedRow[],
): QualityReport {
  const included = new Set(
    mapping.columns.filter((column) => column.include).map((column) => column.index),
  );

  const blanksPerColumn = sheet.columns
    .filter((column) => included.has(column.index))
    .map((column) => ({
      header: column.header,
      blanks: column.cells.filter((cell) => cell.v === null).length,
    }));

  // Duplicates: identical normalized core fields; report 2nd+ occurrences.
  const seen = new Map<string, number>();
  const duplicateRows: number[] = [];
  for (const row of rows) {
    const key = JSON.stringify([
      row.date,
      row.productName,
      row.qty,
      row.unitPrice,
      row.total,
      row.party,
      row.type,
    ]);
    if (seen.has(key)) {
      duplicateRows.push(row.rowIndex);
    } else {
      seen.set(key, row.rowIndex);
    }
  }

  const coercionFailures = rows
    .filter((row) => row.problems.length > 0)
    .map((row) => row.rowIndex);

  // Arithmetic anomalies: qty × price disagrees with total by >1% (SPEC §5.2).
  const arithmeticAnomalies: number[] = [];
  for (const row of rows) {
    if (row.qty === null || row.unitPrice === null || row.total === null) continue;
    const expected = new Decimal(row.qty).mul(row.unitPrice);
    const total = new Decimal(row.total);
    const tolerance = Decimal.max(new Decimal("0.01"), total.abs().mul("0.01"));
    if (expected.minus(total).abs().gt(tolerance)) {
      arithmeticAnomalies.push(row.rowIndex);
    }
  }

  const dates = rows.map((row) => row.date).filter((date): date is string => date !== null);
  const dateRange =
    dates.length > 0
      ? { min: dates.reduce((a, b) => (a < b ? a : b)), max: dates.reduce((a, b) => (a > b ? a : b)) }
      : null;

  // Outliers: > 3σ on each numeric normalized field.
  const outliers: QualityReport["outliers"] = [];
  const numericFields: Array<["qty" | "unitPrice" | "total", string]> = [
    ["qty", "Quantity"],
    ["unitPrice", "Unit price"],
    ["total", "Total"],
  ];
  for (const [field, header] of numericFields) {
    const values = rows
      .map((row) => ({ rowIndex: row.rowIndex, value: row[field] }))
      .filter((entry): entry is { rowIndex: number; value: string } => entry.value !== null)
      .map((entry) => ({ rowIndex: entry.rowIndex, n: Number(entry.value) }))
      .filter((entry) => Number.isFinite(entry.n));
    if (values.length < 8) continue;
    const mean = values.reduce((sum, v) => sum + v.n, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v.n - mean) ** 2, 0) / values.length;
    const sigma = Math.sqrt(variance);
    if (sigma === 0) continue;
    const rowIndexes = values
      .filter((v) => Math.abs(v.n - mean) > 3 * sigma)
      .map((v) => v.rowIndex);
    if (rowIndexes.length > 0) outliers.push({ header, rowIndexes });
  }

  const currencies = new Set<string>();
  for (const column of mapping.columns) {
    if (column.include && (column.role === "unit_price" || column.role === "total_amount")) {
      currencies.add(mapping.currency);
    }
  }

  return {
    rowCount: rows.length,
    blanksPerColumn,
    duplicateRows,
    coercionFailures,
    arithmeticAnomalies,
    dateRange,
    currencies: [...currencies],
    outliers,
  };
}
