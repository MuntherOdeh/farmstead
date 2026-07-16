import Decimal from "decimal.js";
import type { ImportMapping, NormalizedRow } from "@/lib/import/types";

// The §5.5 widget rules engine. From the confirmed mapping + normalized rows
// it produces a RANKED list of widget specs — a rules table, not magic.

export type WidgetKind =
  | "timeseries"
  | "ranked-bar"
  | "donut"
  | "stacked-bar"
  | "scatter"
  | "kpi"
  | "histogram"
  | "small-multiples";

export interface SeriesPoint {
  label: string;
  [series: string]: string | number;
}

export interface WidgetSpec {
  id: string;
  kind: WidgetKind;
  compatibleKinds: WidgetKind[];
  title: string;
  /** One line saying what it actually shows (SPEC §5.5). */
  subtitle: string;
  sourceColumns: string[];
  score: number;
  data: SeriesPoint[];
  seriesKeys: string[];
  /** For "view underlying rows": rowIndexes per label. */
  rowsByLabel: Record<string, number[]>;
  kpi?: { value: string; count: number; mean: string };
}

interface Field {
  key: string;
  label: string;
  importance: number;
  get: (row: NormalizedRow) => string | number | null;
}

const monthOf = (iso: string) => iso.slice(0, 7);

function numericValue(value: string | number | null): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function completeness(rows: NormalizedRow[], field: Field): number {
  if (rows.length === 0) return 0;
  const filled = rows.filter((row) => {
    const v = field.get(row);
    return v !== null && v !== "";
  }).length;
  return filled / rows.length;
}

function distinctValues(rows: NormalizedRow[], field: Field): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const value = field.get(row);
    if (value !== null && value !== "") set.add(String(value));
  }
  return [...set];
}

function buildFields(mapping: ImportMapping, rows: NormalizedRow[]) {
  const measures: Field[] = [];
  const dimensions: Field[] = [];
  let period: Field | null = null;

  const has = (role: string) =>
    mapping.columns.some((column) => column.include && column.role === role);
  const headerOf = (role: string) =>
    mapping.columns.find((column) => column.include && column.role === role)?.header ?? role;

  if (has("period")) {
    period = { key: "date", label: headerOf("period"), importance: 1, get: (row) => row.date };
  }
  if (has("total_amount")) {
    measures.push({ key: "total", label: "Total", importance: 1, get: (row) => row.total });
  }
  if (has("quantity")) {
    measures.push({ key: "qty", label: "Quantity", importance: 0.9, get: (row) => row.qty });
  }
  if (has("unit_price")) {
    measures.push({ key: "unitPrice", label: "Unit price", importance: 0.7, get: (row) => row.unitPrice });
  }
  if (has("entity_name")) {
    dimensions.push({ key: "productName", label: headerOf("entity_name"), importance: 0.95, get: (row) => row.productName });
  }
  if (has("party")) {
    dimensions.push({ key: "party", label: headerOf("party"), importance: 0.85, get: (row) => row.party });
  }
  if (has("transaction_type")) {
    dimensions.push({ key: "type", label: "Type", importance: 0.7, get: (row) => row.type });
  }
  if (has("unit")) {
    dimensions.push({ key: "unitCode", label: headerOf("unit"), importance: 0.5, get: (row) => row.unitCode });
  }

  // extras: numeric → measure, repetitive text → dimension
  const extraHeaders = new Set<string>();
  for (const row of rows.slice(0, 200)) {
    for (const key of Object.keys(row.extras)) extraHeaders.add(key);
  }
  for (const header of extraHeaders) {
    const get = (row: NormalizedRow) => row.extras[header] as string | number | null;
    const values = rows.map(get).filter((v) => v !== null && v !== "");
    if (values.length === 0) continue;
    const numeric = values.filter((v) => numericValue(v as string | number) !== null).length;
    if (numeric / values.length >= 0.8) {
      measures.push({ key: `extra:${header}`, label: header, importance: 0.5, get });
    } else {
      const distinct = new Set(values.map(String)).size;
      if (distinct / values.length <= 0.5 && distinct <= 50) {
        dimensions.push({ key: `extra:${header}`, label: header, importance: 0.5, get });
      }
    }
  }
  return { period, measures, dimensions };
}

function aggregate(
  rows: NormalizedRow[],
  keyOf: (row: NormalizedRow) => string | null,
  measure: Field,
): { totals: Map<string, Decimal>; rowsByLabel: Record<string, number[]> } {
  const totals = new Map<string, Decimal>();
  const rowsByLabel: Record<string, number[]> = {};
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const value = numericValue(measure.get(row));
    if (value === null) continue;
    totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(value));
    (rowsByLabel[key] ??= []).push(row.rowIndex);
  }
  return { totals, rowsByLabel };
}

const cardinalityFit = (distinct: number) =>
  distinct <= 1 ? 0.2 : distinct <= 8 ? 1 : distinct <= 20 ? 0.8 : distinct <= 60 ? 0.6 : 0.35;

export function generateWidgets(
  mapping: ImportMapping,
  rows: NormalizedRow[],
): WidgetSpec[] {
  const { period, measures, dimensions } = buildFields(mapping, rows);
  const widgets: WidgetSpec[] = [];

  // period + measure → time series with MoM delta in subtitle
  if (period) {
    for (const measure of measures) {
      const { totals, rowsByLabel } = aggregate(
        rows,
        (row) => (row.date ? monthOf(row.date) : null),
        measure,
      );
      if (totals.size < 2) continue;
      const labels = [...totals.keys()].sort();
      const data = labels.map((label) => ({
        label,
        [measure.key]: Number(totals.get(label)!.toDecimalPlaces(2)),
      }));
      const last = totals.get(labels[labels.length - 1])!;
      const prev = totals.get(labels[labels.length - 2])!;
      const delta = prev.isZero()
        ? null
        : last.minus(prev).div(prev).mul(100).toDecimalPlaces(1);
      widgets.push({
        id: `timeseries:${measure.key}`,
        kind: "timeseries",
        compatibleKinds: ["timeseries", "ranked-bar"],
        title: `${measure.label} over time`,
        subtitle: `Sum of “${measure.label}” per month${delta !== null ? ` · last month ${delta.gte(0) ? "+" : ""}${delta}% vs previous` : ""}`,
        sourceColumns: [period.label, measure.label],
        score: 1 * measure.importance * completeness(rows, measure),
        data,
        seriesKeys: [measure.key],
        rowsByLabel,
      });
    }
  }

  // dimension + measure → donut (≤6), ranked bar (≤8), top-10+Other (>8)
  for (const dimension of dimensions) {
    const distinct = distinctValues(rows, dimension);
    if (distinct.length < 2) continue;
    for (const measure of measures) {
      const { totals, rowsByLabel } = aggregate(
        rows,
        (row) => {
          const v = dimension.get(row);
          return v === null || v === "" ? null : String(v);
        },
        measure,
      );
      if (totals.size < 2) continue;
      const sorted = [...totals.entries()].sort((a, b) => b[1].minus(a[1]).toNumber());
      let data: SeriesPoint[];
      let subtitle: string;
      if (sorted.length > 8) {
        const top = sorted.slice(0, 10);
        const rest = sorted.slice(10);
        const other = rest.reduce((sum, [, v]) => sum.plus(v), new Decimal(0));
        data = top.map(([label, value]) => ({ label, [measure.key]: Number(value.toDecimalPlaces(2)) }));
        if (rest.length > 0) {
          data.push({ label: "Other", [measure.key]: Number(other.toDecimalPlaces(2)) });
          rowsByLabel["Other"] = rest.flatMap(([label]) => rowsByLabel[label] ?? []);
        }
        subtitle = `Top 10 of ${sorted.length} by “${dimension.label}”, summed “${measure.label}”`;
      } else {
        data = sorted.map(([label, value]) => ({ label, [measure.key]: Number(value.toDecimalPlaces(2)) }));
        subtitle = `Sum of “${measure.label}” by “${dimension.label}”, ranked`;
      }
      const kind: WidgetKind = sorted.length <= 6 ? "donut" : "ranked-bar";
      widgets.push({
        id: `dim:${dimension.key}:${measure.key}`,
        kind,
        compatibleKinds: sorted.length <= 6 ? ["donut", "ranked-bar"] : ["ranked-bar", "donut"],
        title: `${measure.label} by ${dimension.label}`,
        subtitle,
        sourceColumns: [dimension.label, measure.label],
        score:
          dimension.importance *
          measure.importance *
          completeness(rows, dimension) *
          cardinalityFit(sorted.length),
        data,
        seriesKeys: [measure.key],
        rowsByLabel,
      });
    }
  }

  // period + dimension + measure → small multiples (top ≤6 categories)
  if (period && dimensions.length > 0 && measures.length > 0) {
    const dimension = dimensions[0];
    const measure = measures[0];
    const byCategory = aggregate(
      rows,
      (row) => {
        const v = dimension.get(row);
        return v === null || v === "" ? null : String(v);
      },
      measure,
    );
    const topCats = [...byCategory.totals.entries()]
      .sort((a, b) => b[1].minus(a[1]).toNumber())
      .slice(0, 6)
      .map(([label]) => label);
    if (topCats.length >= 2) {
      const months = [
        ...new Set(rows.map((row) => (row.date ? monthOf(row.date) : null)).filter(Boolean)),
      ].sort() as string[];
      if (months.length >= 2) {
        const data: SeriesPoint[] = months.map((month) => {
          const point: SeriesPoint = { label: month };
          for (const cat of topCats) point[cat] = 0;
          return point;
        });
        const rowsByLabel: Record<string, number[]> = {};
        for (const row of rows) {
          if (!row.date) continue;
          const cat = dimension.get(row);
          if (cat === null || !topCats.includes(String(cat))) continue;
          const value = numericValue(measure.get(row));
          if (value === null) continue;
          const point = data.find((p) => p.label === monthOf(row.date!));
          if (point) {
            point[String(cat)] = Number(
              new Decimal(point[String(cat)] as number).plus(value).toDecimalPlaces(2),
            );
            (rowsByLabel[String(cat)] ??= []).push(row.rowIndex);
          }
        }
        widgets.push({
          id: `multiples:${dimension.key}:${measure.key}`,
          kind: "small-multiples",
          compatibleKinds: ["small-multiples", "stacked-bar"],
          title: `${measure.label} by ${dimension.label} over time`,
          subtitle: `Monthly “${measure.label}” for the top ${topCats.length} of “${dimension.label}”`,
          sourceColumns: [period.label, dimension.label, measure.label],
          score: 0.8 * measure.importance * dimension.importance,
          data,
          seriesKeys: topCats,
          rowsByLabel,
        });
      }
    }
  }

  // dimension × dimension + measure → stacked bar
  if (dimensions.length >= 2 && measures.length > 0) {
    const [dimA, dimB] = dimensions;
    const measure = measures[0];
    const aValues = distinctValues(rows, dimA).slice(0, 10);
    const bValues = distinctValues(rows, dimB).slice(0, 6);
    if (aValues.length >= 2 && bValues.length >= 2) {
      const rowsByLabel: Record<string, number[]> = {};
      const data: SeriesPoint[] = aValues.map((a) => {
        const point: SeriesPoint = { label: a };
        for (const b of bValues) point[b] = 0;
        return point;
      });
      for (const row of rows) {
        const a = dimA.get(row);
        const b = dimB.get(row);
        const value = numericValue(measure.get(row));
        if (a === null || b === null || value === null) continue;
        const point = data.find((p) => p.label === String(a));
        if (point && bValues.includes(String(b))) {
          point[String(b)] = Number(
            new Decimal(point[String(b)] as number).plus(value).toDecimalPlaces(2),
          );
          (rowsByLabel[String(a)] ??= []).push(row.rowIndex);
        }
      }
      widgets.push({
        id: `stack:${dimA.key}:${dimB.key}:${measure.key}`,
        kind: "stacked-bar",
        compatibleKinds: ["stacked-bar"],
        title: `${measure.label}: ${dimA.label} × ${dimB.label}`,
        subtitle: `“${measure.label}” split by “${dimB.label}” within each “${dimA.label}”`,
        sourceColumns: [dimA.label, dimB.label, measure.label],
        score: 0.6 * measure.importance * cardinalityFit(aValues.length),
        data,
        seriesKeys: bValues,
        rowsByLabel,
      });
    }
  }

  // measure × measure → scatter (sampled)
  if (measures.length >= 2) {
    const [mx, my] = measures;
    const points: SeriesPoint[] = [];
    const rowsByLabel: Record<string, number[]> = {};
    for (const row of rows) {
      const x = numericValue(mx.get(row));
      const y = numericValue(my.get(row));
      if (x === null || y === null) continue;
      points.push({ label: `#${row.rowIndex + 2}`, x, y });
      rowsByLabel[`#${row.rowIndex + 2}`] = [row.rowIndex];
      if (points.length >= 500) break;
    }
    if (points.length >= 8) {
      widgets.push({
        id: `scatter:${mx.key}:${my.key}`,
        kind: "scatter",
        compatibleKinds: ["scatter"],
        title: `${my.label} vs ${mx.label}`,
        subtitle: `Each point is a row — “${mx.label}” across, “${my.label}” up`,
        sourceColumns: [mx.label, my.label],
        score: 0.5 * mx.importance * my.importance,
        data: points,
        seriesKeys: ["y"],
        rowsByLabel,
      });
    }
  }

  // single measure → KPI + histogram
  for (const measure of measures.slice(0, 2)) {
    const values = rows
      .map((row) => ({ rowIndex: row.rowIndex, n: numericValue(measure.get(row)) }))
      .filter((entry): entry is { rowIndex: number; n: number } => entry.n !== null);
    if (values.length < 4) continue;
    const sum = values.reduce((acc, v) => acc.plus(v.n), new Decimal(0));
    const mean = sum.div(values.length);
    const min = Math.min(...values.map((v) => v.n));
    const max = Math.max(...values.map((v) => v.n));
    const binCount = Math.min(12, Math.max(5, Math.round(Math.sqrt(values.length))));
    const width = (max - min) / binCount || 1;
    const bins: SeriesPoint[] = Array.from({ length: binCount }, (_, i) => ({
      label: `${new Decimal(min + i * width).toDecimalPlaces(1)}–${new Decimal(min + (i + 1) * width).toDecimalPlaces(1)}`,
      count: 0,
    }));
    const rowsByLabel: Record<string, number[]> = {};
    for (const v of values) {
      const index = Math.min(binCount - 1, Math.floor((v.n - min) / width));
      bins[index].count = (bins[index].count as number) + 1;
      (rowsByLabel[bins[index].label] ??= []).push(v.rowIndex);
    }
    widgets.push({
      id: `kpi:${measure.key}`,
      kind: "kpi",
      compatibleKinds: ["kpi", "histogram"],
      title: measure.label,
      subtitle: `Total, and how “${measure.label}” is distributed across rows`,
      sourceColumns: [measure.label],
      score: 0.55 * measure.importance,
      data: bins,
      seriesKeys: ["count"],
      rowsByLabel,
      kpi: {
        value: sum.toDecimalPlaces(2).toString(),
        count: values.length,
        mean: mean.toDecimalPlaces(2).toString(),
      },
    });
  }

  return widgets.sort((a, b) => b.score - a.score);
}
