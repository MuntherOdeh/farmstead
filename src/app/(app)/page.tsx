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
import {
  alerts,
  categoryMix,
  kpis,
  recentTransactions,
  revenueSeries,
  topProducts,
} from "@/lib/demo/overview";

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <AlertsStrip data={alerts} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & costs</CardTitle>
            <CardDescription>Monthly totals, Jan 2025 – Jun 2026</CardDescription>
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
            <RecentTransactions data={recentTransactions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
