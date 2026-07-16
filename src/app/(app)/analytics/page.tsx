import Decimal from "decimal.js";
import { format, subDays, subMonths } from "date-fns";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PivotBuilder, type PivotRow } from "@/components/analytics/pivot-builder";
import { TrendChart, type TrendChartPoint } from "@/components/analytics/trend-chart";
import {
  herdReconciliation,
  monthlyTrend,
  mortalityRate,
  naiveForecast,
  perUnitYield,
  profitBy,
  profitSummary,
  yoyPct,
} from "@/lib/analytics/calc";
import { loadLedger, loadProductSnapshots } from "@/lib/analytics/queries";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const fmt = (value: Decimal | null, digits = 0) =>
  value === null ? "—" : Number(value.toFixed(digits)).toLocaleString("en-GB");

export default async function AnalyticsPage() {
  await requireUser();
  const [ledger, products] = await Promise.all([loadLedger(), loadProductSnapshots()]);

  const trailing12Start = format(subMonths(new Date(), 12), "yyyy-MM-dd");
  const trailingRows = ledger.filter((row) => row.occurredOn >= trailing12Start);
  const summary = profitSummary(trailingRows);

  const trend = monthlyTrend(ledger, (row) =>
    row.type === "sale" ? new Decimal(row.total ?? 0) : null,
  );
  const forecast = naiveForecast(trend);
  const yoy = yoyPct(trend);
  const lastMom = trend.at(-1)?.momPct ?? null;
  const trendData: TrendChartPoint[] = trend.slice(-18).map((point) => ({
    month: format(new Date(`${point.month}-01`), "MMM yy"),
    revenue: Number(point.value.toFixed(0)),
    ma3: point.ma3 ? Number(point.ma3.toFixed(0)) : null,
  }));

  const reconciliation = herdReconciliation(ledger, products);
  const mortality = mortalityRate(reconciliation);
  const allBalance = reconciliation.every((row) => row.balances);

  // ── Yields, with honest unit labels (SPEC §9) ──
  const last90 = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const sumQty = (predicate: (row: (typeof ledger)[number]) => boolean, since?: string) =>
    ledger
      .filter((row) => row.type === "sale" && predicate(row) && (!since || row.occurredOn >= since))
      .reduce((sum, row) => sum.plus(row.qty), new Decimal(0));
  const stockOf = (predicate: (p: (typeof products)[number]) => boolean) =>
    products.filter(predicate).reduce((sum, p) => sum.plus(p.stockQty), new Decimal(0));

  const cows = stockOf((p) => p.species === "cattle" && p.unitCode === "head");
  const hives = stockOf((p) => p.unitCode === "hive");
  const sheep = stockOf((p) => p.species === "sheep" && p.unitCode === "head");
  const birds = stockOf((p) => p.species === "poultry" && p.unitCode === "head");

  const yields = [
    {
      label: "Milk per cow per day",
      value: perUnitYield(sumQty((r) => r.categorySlug === "milk" && r.species === "cattle", last90), cows, new Decimal(90)),
      unit: "L · last 90 days",
    },
    {
      label: "Honey per hive per season",
      value: perUnitYield(sumQty((r) => r.categorySlug === "honey", trailing12Start), hives, new Decimal(1)),
      unit: "jars/pieces · last 12 months",
    },
    {
      label: "Wool per head per year",
      value: perUnitYield(sumQty((r) => r.categorySlug === "wool", trailing12Start), sheep, new Decimal(1)),
      unit: "kg · last 12 months",
    },
    {
      label: "Eggs per bird per week",
      value: perUnitYield(
        sumQty((r) => r.categorySlug === "eggs", last90).mul(12),
        birds,
        new Decimal(90).div(7),
      ),
      unit: "eggs · last 90 days",
    },
  ];

  const byProduct = profitBy(trailingRows, (row) => ({ key: row.productId, label: row.productName }));
  const withMargin = byProduct.filter((entry) => entry.marginPct !== null && entry.revenue.gt(50));
  const top = [...withMargin].sort((a, b) => b.marginPct!.minus(a.marginPct!).toNumber()).slice(0, 5);
  const bottom = [...withMargin]
    .sort((a, b) => a.marginPct!.minus(b.marginPct!).toNumber())
    .slice(0, 5);

  const pivotRows: PivotRow[] = ledger.map((row) => ({
    productName: row.productName,
    categoryName: row.categoryName,
    species: row.species,
    partyName: row.partyName,
    type: row.type,
    occurredOn: row.occurredOn,
    qty: row.qty,
    total: row.total,
    costPrice: row.costPrice,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Margins, herd movement, yields and a pivot over the whole ledger.
        </p>
      </div>

      <div className="kpi grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue · 12 months", value: formatMoney(Number(summary.revenue.toFixed(0))) },
          { label: "COGS · 12 months", value: formatMoney(Number(summary.cogs.toFixed(0))) },
          { label: "Gross margin", value: formatMoney(Number(summary.grossMargin.toFixed(0))) },
          {
            label: "Margin %",
            value: summary.marginPct ? `${summary.marginPct.toFixed(1)}%` : "—",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="font-heading text-2xl font-semibold tracking-tight">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            Revenue trend
            {lastMom ? (
              <Badge variant="outline" className="font-mono">
                MoM {lastMom.gte(0) ? "+" : ""}
                {lastMom.toFixed(1)}%
              </Badge>
            ) : null}
            {yoy ? (
              <Badge variant="outline" className="font-mono">
                YoY {yoy.gte(0) ? "+" : ""}
                {yoy.toFixed(1)}%
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Monthly sales with a 3-month moving average. The forecast line is
            deliberately naive — the average of the last three months, nothing
            cleverer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart data={trendData} forecast={forecast ? Number(forecast.toFixed(0)) : null} />
        </CardContent>
      </Card>

      <Card className={cn(!allBalance && "border-destructive/50")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Herd movement reconciliation
            {allBalance ? (
              <Badge className="gap-1 border-transparent bg-chart-1/15 text-foreground">
                <CircleCheck className="size-3.5" /> balances
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlert className="size-3.5" /> discrepancy
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            opening + births + purchases − sales − deaths − consumption = closing
            {mortality ? ` · mortality ${mortality.toFixed(1)}% of average herd` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Animal</TableHead>
                <TableHead className="text-end">Opening</TableHead>
                <TableHead className="text-end">Births</TableHead>
                <TableHead className="text-end">Purchases</TableHead>
                <TableHead className="text-end">Sales</TableHead>
                <TableHead className="text-end">Deaths</TableHead>
                <TableHead className="text-end">Consumed</TableHead>
                <TableHead className="text-end">Closing</TableHead>
                <TableHead className="text-end">Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliation.map((row) => (
                <TableRow key={row.productId} className={cn(!row.balances && "bg-destructive/5")}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.opening)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.births)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.purchases)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.sales)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.deaths)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.consumption)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{fmt(row.actualClosing)}</TableCell>
                  <TableCell className="text-end">
                    {row.balances ? (
                      <CircleCheck className="ms-auto size-4 text-muted-foreground" />
                    ) : (
                      <span className="font-mono text-xs text-destructive">
                        {row.discrepancy.gte(0) ? "+" : ""}
                        {row.discrepancy.toFixed(0)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="kpi grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {yields.map((entry) => (
          <Card key={entry.label}>
            <CardContent>
              <p className="text-sm text-muted-foreground">{entry.label}</p>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {entry.value === null ? "—" : entry.value.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">{entry.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Best margins", rows: top },
          { title: "Worst margins", rows: bottom },
        ].map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>Products by margin %, last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-end">Revenue</TableHead>
                    <TableHead className="text-end">Profit</TableHead>
                    <TableHead className="text-end">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((entry) => (
                    <TableRow key={entry.key}>
                      <TableCell className="max-w-40 truncate font-medium">{entry.label}</TableCell>
                      <TableCell className="text-end font-mono text-xs">
                        {formatMoney(Number(entry.revenue.toFixed(0)))}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs">
                        {formatMoney(Number(entry.profit.toFixed(0)))}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs">
                        {entry.marginPct!.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <PivotBuilder rows={pivotRows} />
    </div>
  );
}
