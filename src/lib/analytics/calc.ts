import Decimal from "decimal.js";

// SPEC §9 — all money in Decimal, round only at display.

export interface LedgerRow {
  type: "sale" | "purchase" | "birth" | "death" | "consumption" | "adjustment" | "expense";
  occurredOn: string; // yyyy-MM-dd
  productId: string;
  productName: string;
  categorySlug: string;
  categoryName: string;
  species: string | null;
  unitCode: string | null;
  qty: string;
  unitPrice: string | null;
  total: string | null;
  costPrice: string | null; // product's cost price at read time
  partyId: string | null;
  partyName: string | null;
}

export interface ProductSnapshot {
  id: string;
  name: string;
  sku: string | null;
  categorySlug: string;
  categoryName: string;
  species: string | null;
  unitCode: string;
  stockQty: string;
  costPrice: string | null;
  unitPrice: string | null;
  reorderLevel: string | null;
}

const D = (value: string | null | undefined): Decimal =>
  value === null || value === undefined || value === "" ? new Decimal(0) : new Decimal(value);

export const monthOf = (iso: string) => iso.slice(0, 7);

/** Revenue = sale totals; COGS = qty × product cost for those sales. */
export function profitSummary(rows: LedgerRow[]) {
  let revenue = new Decimal(0);
  let cogs = new Decimal(0);
  let expenses = new Decimal(0);
  for (const row of rows) {
    if (row.type === "sale") {
      revenue = revenue.plus(D(row.total));
      cogs = cogs.plus(D(row.qty).mul(D(row.costPrice)));
    } else if (row.type === "expense") {
      expenses = expenses.plus(D(row.total));
    }
  }
  const grossMargin = revenue.minus(cogs);
  const marginPct = revenue.isZero() ? null : grossMargin.div(revenue).mul(100);
  const markupPct = cogs.isZero() ? null : grossMargin.div(cogs).mul(100);
  return { revenue, cogs, expenses, grossMargin, marginPct, markupPct };
}

export function stockValuation(products: ProductSnapshot[]): Decimal {
  return products.reduce(
    (sum, product) => sum.plus(D(product.stockQty).mul(D(product.costPrice))),
    new Decimal(0),
  );
}

export interface GroupedProfit {
  key: string;
  label: string;
  revenue: Decimal;
  cogs: Decimal;
  profit: Decimal;
  marginPct: Decimal | null;
  qty: Decimal;
}

export function profitBy(
  rows: LedgerRow[],
  keyOf: (row: LedgerRow) => { key: string; label: string } | null,
): GroupedProfit[] {
  const groups = new Map<string, GroupedProfit>();
  for (const row of rows) {
    if (row.type !== "sale") continue;
    const grouped = keyOf(row);
    if (!grouped) continue;
    const entry =
      groups.get(grouped.key) ??
      ({
        key: grouped.key,
        label: grouped.label,
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        profit: new Decimal(0),
        marginPct: null,
        qty: new Decimal(0),
      } satisfies GroupedProfit);
    entry.revenue = entry.revenue.plus(D(row.total));
    entry.cogs = entry.cogs.plus(D(row.qty).mul(D(row.costPrice)));
    entry.qty = entry.qty.plus(D(row.qty));
    groups.set(grouped.key, entry);
  }
  const list = [...groups.values()];
  for (const entry of list) {
    entry.profit = entry.revenue.minus(entry.cogs);
    entry.marginPct = entry.revenue.isZero() ? null : entry.profit.div(entry.revenue).mul(100);
  }
  return list.sort((a, b) => b.revenue.minus(a.revenue).toNumber());
}

// ── Herd movement reconciliation (SPEC §9) ─────────────────────────────────
// opening + births + purchases − sales − deaths − consumption = closing.
// It MUST balance; if it doesn't, the discrepancy is shown loudly.

export interface HerdReconciliationRow {
  productId: string;
  productName: string;
  opening: Decimal;
  births: Decimal;
  purchases: Decimal;
  sales: Decimal;
  deaths: Decimal;
  consumption: Decimal;
  adjustments: Decimal;
  expectedClosing: Decimal;
  actualClosing: Decimal;
  discrepancy: Decimal;
  balances: boolean;
}

export function herdReconciliation(
  rows: LedgerRow[],
  products: ProductSnapshot[],
  options?: { headUnitCodes?: string[] },
): HerdReconciliationRow[] {
  const headUnits = new Set(options?.headUnitCodes ?? ["head", "hive"]);
  const herdProducts = products.filter((product) => headUnits.has(product.unitCode));
  const results: HerdReconciliationRow[] = [];

  for (const product of herdProducts) {
    const movements = rows.filter((row) => row.productId === product.id);
    const sum = (type: LedgerRow["type"]) =>
      movements
        .filter((row) => row.type === type)
        .reduce((acc, row) => acc.plus(D(row.qty)), new Decimal(0));

    const births = sum("birth");
    const purchases = sum("purchase");
    const sales = sum("sale");
    const deaths = sum("death");
    const consumption = sum("consumption");
    // Manual stock adjustments are signed in notes but stored absolute; they
    // are listed so the owner sees them, and included in the identity.
    const adjustments = sum("adjustment");

    const actualClosing = D(product.stockQty);
    const net = births.plus(purchases).minus(sales).minus(deaths).minus(consumption);
    // opening derived from the ledger identity, then verified both ways:
    const opening = actualClosing.minus(net);
    const expectedClosing = opening.plus(net);
    const discrepancy = actualClosing.minus(expectedClosing);

    results.push({
      productId: product.id,
      productName: product.name,
      opening,
      births,
      purchases,
      sales,
      deaths,
      consumption,
      adjustments,
      expectedClosing,
      actualClosing,
      discrepancy,
      balances: discrepancy.abs().lt("0.0001") && opening.gte(0),
    });
  }
  return results.sort((a, b) => b.actualClosing.minus(a.actualClosing).toNumber());
}

export function mortalityRate(reconciliation: HerdReconciliationRow[]): Decimal | null {
  let deaths = new Decimal(0);
  let averageHerd = new Decimal(0);
  for (const row of reconciliation) {
    deaths = deaths.plus(row.deaths);
    averageHerd = averageHerd.plus(row.opening.plus(row.actualClosing).div(2));
  }
  if (averageHerd.isZero()) return null;
  return deaths.div(averageHerd).mul(100);
}

// ── Time series: deltas, moving average, naive forecast ───────────────────

export interface TrendPoint {
  month: string; // yyyy-MM
  value: Decimal;
  ma3: Decimal | null;
  momPct: Decimal | null;
}

export function monthlyTrend(
  rows: LedgerRow[],
  pick: (row: LedgerRow) => Decimal | null,
): TrendPoint[] {
  const byMonth = new Map<string, Decimal>();
  for (const row of rows) {
    const value = pick(row);
    if (value === null) continue;
    const key = monthOf(row.occurredOn);
    byMonth.set(key, (byMonth.get(key) ?? new Decimal(0)).plus(value));
  }
  const months = [...byMonth.keys()].sort();
  return months.map((month, index) => {
    const value = byMonth.get(month)!;
    const window = months.slice(Math.max(0, index - 2), index + 1);
    const ma3 =
      window.length === 3
        ? window
            .reduce((acc, m) => acc.plus(byMonth.get(m)!), new Decimal(0))
            .div(3)
        : null;
    const prev = index > 0 ? byMonth.get(months[index - 1])! : null;
    const momPct = prev && !prev.isZero() ? value.minus(prev).div(prev).mul(100) : null;
    return { month, value, ma3, momPct };
  });
}

/** Honestly naive: the average of the last three months (SPEC §9). */
export function naiveForecast(trend: TrendPoint[]): Decimal | null {
  if (trend.length < 3) return null;
  return trend
    .slice(-3)
    .reduce((acc, point) => acc.plus(point.value), new Decimal(0))
    .div(3);
}

export function yoyPct(trend: TrendPoint[]): Decimal | null {
  if (trend.length < 13) return null;
  const last = trend[trend.length - 1];
  const yearAgo = trend[trend.length - 13];
  if (yearAgo.value.isZero()) return null;
  return last.value.minus(yearAgo.value).div(yearAgo.value).mul(100);
}

// ── Yields (SPEC §9) — labels stay honest about units ──────────────────────

export function perUnitYield(
  produced: Decimal,
  producers: Decimal,
  periods: Decimal,
): Decimal | null {
  if (producers.isZero() || periods.isZero()) return null;
  return produced.div(producers).div(periods);
}
