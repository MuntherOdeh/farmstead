import Decimal from "decimal.js";
import { format, subMonths } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertsStrip } from "@/components/dashboard/alerts-card";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopProducts } from "@/components/dashboard/top-products";
import type {
  AlertFixture,
  CategorySlice,
  MonthPoint,
  RecentTransaction,
  TopProduct,
  TransactionType,
} from "@/lib/demo/overview";
import {
  monthOf,
  monthlyTrend,
  profitBy,
  profitSummary,
  stockValuation,
} from "@/lib/analytics/calc";
import { loadLedger, loadProductSnapshots } from "@/lib/analytics/queries";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/auth/require-user";

export default async function OverviewPage() {
  await requireUser();
  const [ledger, products] = await Promise.all([loadLedger(), loadProductSnapshots()]);

  const now = new Date();
  const thisMonth = format(now, "yyyy-MM");
  const lastMonth = format(subMonths(now, 1), "yyyy-MM");
  const trailing12Start = format(subMonths(now, 12), "yyyy-MM-dd");

  // ── KPIs ──
  const monthRows = ledger.filter((row) => monthOf(row.occurredOn) === thisMonth);
  const prevRows = ledger.filter((row) => monthOf(row.occurredOn) === lastMonth);
  const monthSummary = profitSummary(monthRows);
  const prevSummary = profitSummary(prevRows);
  const revenueDelta = prevSummary.revenue.isZero()
    ? 0
    : Number(
        monthSummary.revenue
          .minus(prevSummary.revenue)
          .div(prevSummary.revenue)
          .mul(100)
          .toFixed(1),
      );
  const marginDeltaPts =
    monthSummary.marginPct && prevSummary.marginPct
      ? Number(monthSummary.marginPct.minus(prevSummary.marginPct).toFixed(1))
      : 0;
  const headCount = products
    .filter((product) => product.unitCode === "head")
    .reduce((sum, product) => sum.plus(product.stockQty), new Decimal(0));
  const stockValue = stockValuation(products);

  const kpis = [
    {
      label: `Revenue · ${format(now, "MMMM")}`,
      value: formatMoney(Number(monthSummary.revenue.toFixed(0))),
      delta: revenueDelta,
      deltaLabel: `vs ${format(subMonths(now, 1), "MMM")}`,
    },
    {
      label: "Gross margin",
      value: monthSummary.marginPct ? `${monthSummary.marginPct.toFixed(1)}%` : "—",
      delta: marginDeltaPts,
      deltaLabel: "pts vs last month",
    },
    {
      label: "Head count",
      value: headCount.toFixed(0),
      delta: 0,
      deltaLabel: "livestock on hand",
    },
    {
      label: "Stock value",
      value: formatMoney(Number(stockValue.toFixed(0))),
      delta: 0,
      deltaLabel: "at cost",
    },
  ];

  // ── Revenue & costs series (18 months) ──
  const revenueTrend = monthlyTrend(ledger, (row) =>
    row.type === "sale" ? new Decimal(row.total ?? 0) : null,
  );
  const costTrend = monthlyTrend(ledger, (row) =>
    row.type === "purchase" || row.type === "expense" ? new Decimal(row.total ?? 0) : null,
  );
  const costByMonth = new Map(costTrend.map((point) => [point.month, point.value]));
  const revenueSeries: MonthPoint[] = revenueTrend.slice(-18).map((point) => ({
    month: format(new Date(`${point.month}-01`), "MMM yy"),
    revenue: Number(point.value.toFixed(0)),
    costs: Number((costByMonth.get(point.month) ?? new Decimal(0)).toFixed(0)),
  }));

  // ── Mix + top products (trailing 12 months) ──
  const trailingRows = ledger.filter((row) => row.occurredOn >= trailing12Start);
  const byCategory = profitBy(trailingRows, (row) => ({
    key: row.categorySlug,
    label: row.categoryName,
  }));
  const PALETTE_KEYS = ["sheep", "dairy", "cattle", "honey", "wool"];
  const categoryMix: CategorySlice[] = byCategory.slice(0, 5).map((entry, index) => ({
    key: PALETTE_KEYS[index],
    label: entry.label,
    revenue: Number(entry.revenue.toFixed(0)),
  }));
  const topProducts: TopProduct[] = profitBy(trailingRows, (row) => ({
    key: row.productId,
    label: row.productName,
  }))
    .slice(0, 6)
    .map((entry) => ({
      name: entry.label,
      revenue: Number(entry.revenue.toFixed(0)),
      marginPct: entry.marginPct ? Number(entry.marginPct.toFixed(0)) : 0,
    }));

  // ── Recent transactions ──
  const recent: RecentTransaction[] = [...ledger]
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1))
    .slice(0, 8)
    .map((row) => ({
      date: format(new Date(row.occurredOn), "d MMM"),
      type: (["sale", "purchase", "birth", "expense"].includes(row.type)
        ? row.type
        : "expense") as TransactionType,
      product: row.productName,
      party: row.partyName ?? "—",
      qty: `${new Decimal(row.qty).toFixed(0)} ${row.unitCode ?? ""}`.trim(),
      total: row.total ? formatMoney(Number(new Decimal(row.total).toFixed(2))) : "—",
    }));

  // ── Alerts ──
  const alerts: AlertFixture[] = [];
  const lowStock = products.filter(
    (product) =>
      product.reorderLevel !== null &&
      new Decimal(product.stockQty).lt(product.reorderLevel),
  );
  if (lowStock.length > 0) {
    alerts.push({
      severity: "critical",
      title: `Low stock — ${lowStock[0].name}`,
      detail:
        lowStock.length === 1
          ? `${new Decimal(lowStock[0].stockQty).toFixed(0)} left, reorder at ${new Decimal(lowStock[0].reorderLevel!).toFixed(0)}.`
          : `${lowStock.length} products are below their reorder level.`,
    });
  }
  const anomalies = ledger.filter((row) => row.notes?.includes("anomaly"));
  if (anomalies.length > 0) {
    alerts.push({
      severity: "warning",
      title: `${anomalies.length} ledger anomalies`,
      detail: "Rows where the arithmetic or price looks wrong — see Analytics.",
    });
  }
  if (revenueDelta < -10) {
    alerts.push({
      severity: "info",
      title: "Revenue dip",
      detail: `This month is ${Math.abs(revenueDelta)}% below last month so far.`,
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {alerts.length > 0 ? <AlertsStrip data={alerts} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & costs</CardTitle>
            <CardDescription>Monthly totals from the ledger</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by category</CardTitle>
            <CardDescription>Share of the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={categoryMix} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>Revenue and margin, last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProducts data={topProducts} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>The latest ledger entries</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentTransactions data={recent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
