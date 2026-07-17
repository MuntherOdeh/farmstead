import Decimal from "decimal.js";
import { format, subMonths } from "date-fns";
import { Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { AlertsStrip } from "@/components/dashboard/alerts-card";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { ComparisonChart } from "@/components/dashboard/comparison-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopProducts, type RankedItem } from "@/components/dashboard/top-products";
import type {
  AlertFixture,
  CategorySlice,
  MonthPoint,
  RecentTransaction,
  TransactionType,
} from "@/lib/demo/overview";
import { monthOf, monthlyTrend, profitBy, profitSummary, stockValuation } from "@/lib/analytics/calc";
import { loadLedger, loadProductSnapshots } from "@/lib/analytics/queries";
import { formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/auth/require-user";

export default async function OverviewPage() {
  const user = await requireUser();
  const [ledger, products] = await Promise.all([loadLedger(), loadProductSnapshots()]);

  // Fresh farm: nothing to chart yet — say so instead of a wall of zeros.
  if (ledger.length === 0 && products.length === 0) {
    return (
      <Empty className="min-h-[70vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Upload />
          </EmptyMedia>
          <EmptyTitle>The farm is empty</EmptyTitle>
          <EmptyDescription>
            Import your spreadsheets and this page fills itself with revenue,
            costs, categories and alerts — or load the demo data from Settings
            to see it working.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button asChild>
            <Link href="/import">Import a spreadsheet</Link>
          </Button>
          {user.role === "admin" ? (
            <Button variant="outline" asChild>
              <Link href="/settings">Load demo data</Link>
            </Button>
          ) : null}
        </EmptyContent>
      </Empty>
    );
  }

  const now = new Date();
  const months = [...new Set(ledger.map((row) => monthOf(row.occurredOn)))].sort();
  const hasTimeline = months.length >= 3;
  const trailing12Start = format(subMonths(now, 12), "yyyy-MM-dd");
  const windowRows = hasTimeline
    ? ledger.filter((row) => row.occurredOn >= trailing12Start)
    : ledger;
  const windowLabel = hasTimeline ? "last 12 months" : "all recorded";

  const summary = profitSummary(windowRows);
  const purchases = windowRows
    .filter((row) => row.type === "purchase")
    .reduce((sum, row) => sum.plus(row.total ?? 0), new Decimal(0));
  const totalCosts = summary.expenses.plus(purchases);
  const net = summary.revenue.minus(totalCosts);
  const unpaid = windowRows
    .filter((row) => row.type === "sale" && row.notes?.includes("غير مدفوع"))
    .reduce((sum, row) => sum.plus(row.total ?? 0), new Decimal(0));
  const hasCogs = summary.cogs.gt(0);
  const headCount = products
    .filter((product) => product.unitCode === "head")
    .reduce((sum, product) => sum.plus(product.stockQty), new Decimal(0));
  const stockValue = stockValuation(products);

  // Month-over-month deltas only when a real prior month exists.
  const thisMonth = format(now, "yyyy-MM");
  const lastMonth = format(subMonths(now, 1), "yyyy-MM");
  const prevSummary = profitSummary(ledger.filter((row) => monthOf(row.occurredOn) === lastMonth));
  const monthSummary = profitSummary(ledger.filter((row) => monthOf(row.occurredOn) === thisMonth));
  const revenueDelta = prevSummary.revenue.gt(0)
    ? Number(
        monthSummary.revenue.minus(prevSummary.revenue).div(prevSummary.revenue).mul(100).toFixed(1),
      )
    : null;

  const kpis: {
    label: string;
    value: string;
    delta?: number;
    deltaLabel?: string | null;
    caption?: string;
    tone?: "default" | "negative";
  }[] = [
    {
      label: "Revenue",
      value: formatMoney(Number(summary.revenue.toFixed(0))),
      ...(revenueDelta !== null
        ? { delta: revenueDelta, deltaLabel: `vs ${format(subMonths(now, 1), "MMM")}` }
        : { caption: windowLabel }),
    },
    {
      label: "Costs",
      value: formatMoney(Number(totalCosts.toFixed(0))),
      caption: `expenses ${formatMoney(Number(summary.expenses.toFixed(0)))} · purchases ${formatMoney(Number(purchases.toFixed(0)))}`,
    },
    {
      label: "Net position",
      value: formatMoney(Number(net.toFixed(0))),
      caption: "revenue − all costs",
      tone: net.isNegative() ? "negative" : "default",
    },
  ];
  if (unpaid.gt(0)) {
    kpis.push({
      label: "Unpaid sales",
      value: formatMoney(Number(unpaid.toFixed(0))),
      caption: "marked غير مدفوع",
    });
  } else if (hasCogs && summary.marginPct) {
    kpis.push({
      label: "Gross margin",
      value: `${summary.marginPct.toFixed(1)}%`,
      caption: "sales minus cost of goods",
    });
  } else if (headCount.gt(0)) {
    kpis.push({
      label: "Head count",
      value: headCount.toFixed(0),
      caption: "livestock on hand",
    });
  } else {
    kpis.push({
      label: "Stock value",
      value: formatMoney(Number(stockValue.toFixed(0))),
      caption: "at cost",
    });
  }

  // ── Charts ──
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

  const comparisonData = [
    { label: "Revenue", value: Number(summary.revenue.toFixed(0)), colorVar: "var(--chart-1)" },
    { label: "Expenses", value: Number(summary.expenses.toFixed(0)), colorVar: "var(--chart-4)" },
    { label: "Purchases", value: Number(purchases.toFixed(0)), colorVar: "var(--chart-3)" },
  ].filter((bar) => bar.value > 0);

  // ── Category mixes ──
  const revenueMix: CategorySlice[] = profitBy(windowRows, (row) => ({
    key: row.categorySlug,
    label: row.categoryName,
  }))
    .slice(0, 5)
    .map((entry, index) => ({
      key: `rev-${index}`,
      label: entry.label,
      revenue: Number(entry.revenue.toFixed(0)),
    }));

  const costGroups = new Map<string, Decimal>();
  for (const row of windowRows) {
    if (row.type !== "expense" && row.type !== "purchase") continue;
    const key = row.categoryName;
    costGroups.set(key, (costGroups.get(key) ?? new Decimal(0)).plus(row.total ?? 0));
  }
  const costMix: CategorySlice[] = [...costGroups.entries()]
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .slice(0, 5)
    .map(([label, value], index) => ({
      key: `cost-${index}`,
      label,
      revenue: Number(value.toFixed(0)),
    }));

  // ── Ranked lists ──
  const topProducts: RankedItem[] = profitBy(windowRows, (row) => ({
    key: row.productId,
    label: row.productName,
  }))
    .slice(0, 6)
    .map((entry) => ({
      name: entry.label,
      revenue: Number(entry.revenue.toFixed(0)),
      ...(hasCogs && entry.marginPct !== null
        ? { marginPct: Number(entry.marginPct.toFixed(0)) }
        : {}),
    }));

  const expenseGroups = new Map<string, { total: Decimal; category: string }>();
  for (const row of windowRows) {
    if (row.type !== "expense" && row.type !== "purchase") continue;
    const entry = expenseGroups.get(row.productName) ?? {
      total: new Decimal(0),
      category: row.categoryName,
    };
    entry.total = entry.total.plus(row.total ?? 0);
    expenseGroups.set(row.productName, entry);
  }
  const topExpenses: RankedItem[] = [...expenseGroups.entries()]
    .sort((a, b) => b[1].total.minus(a[1].total).toNumber())
    .slice(0, 6)
    .map(([name, entry]) => ({
      name,
      revenue: Number(entry.total.toFixed(0)),
      hint: entry.category,
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
      product.reorderLevel !== null && new Decimal(product.stockQty).lt(product.reorderLevel),
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
  if (unpaid.gt(0)) {
    alerts.push({
      severity: "warning",
      title: `Unpaid sales: ${formatMoney(Number(unpaid.toFixed(0)))}`,
      detail: "Rows marked غير مدفوع in the sales ledger.",
    });
  }
  if (net.isNegative()) {
    alerts.push({
      severity: "info",
      title: `Costs exceed revenue by ${formatMoney(Number(net.abs().toFixed(0)))}`,
      detail: "Includes one-off investments like land and construction.",
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
            <CardTitle>{hasTimeline ? "Revenue & costs" : "The money story"}</CardTitle>
            <CardDescription>
              {hasTimeline
                ? "Monthly totals from the ledger"
                : "Totals from the ledger — the file carries no dates, so there is no timeline yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasTimeline ? (
              <RevenueChart data={revenueSeries} />
            ) : (
              <ComparisonChart data={comparisonData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by category</CardTitle>
            <CardDescription>Where the money comes from · {windowLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueMix.length > 0 ? (
              <CategoryDonut data={revenueMix} caption={hasTimeline ? "12 months" : "all sales"} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No sales yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Costs by section</CardTitle>
            <CardDescription>Where the money goes · {windowLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {costMix.length > 0 ? (
              <CategoryDonut data={costMix} caption={hasTimeline ? "12 months" : "all costs"} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No costs recorded.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>By revenue · {windowLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <TopProducts data={topProducts} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No sales yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Biggest cost items</CardTitle>
            <CardDescription>By amount · {windowLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {topExpenses.length > 0 ? (
              <TopProducts data={topExpenses} barClass="bg-chart-4" />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No costs recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>The latest ledger entries</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransactions data={recent} />
        </CardContent>
      </Card>
    </div>
  );
}
