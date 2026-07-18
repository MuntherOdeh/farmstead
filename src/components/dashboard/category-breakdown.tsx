import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CategoryRow {
  name: string;
  kind: string;
  products: number;
  revenue: number;
  cost: number;
}

const KIND_LABEL: Record<string, string> = {
  livestock: "Livestock",
  apiary: "Bees & honey",
  dairy: "Dairy",
  crop: "Crops",
  input: "Inputs",
  equipment: "Equipment",
  other: "Other",
};

// Every category the farm touches — with both what it earned and what it cost,
// so a section with only costs (e.g. bees) is still visible, not hidden by a
// revenue-only chart.
export function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const maxActivity = Math.max(...rows.map((r) => Math.max(r.revenue, r.cost)), 1);

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 pb-2 text-xs text-muted-foreground sm:grid-cols-[1.5fr_1fr_auto_auto]">
        <span>Category</span>
        <span className="hidden sm:block">Activity</span>
        <span className="text-end">Revenue</span>
        <span className="text-end">Cost</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 text-sm sm:grid-cols-[1.5fr_1fr_auto_auto]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <bdi className="truncate font-medium">{row.name}</bdi>
            <Badge variant="outline" className="hidden shrink-0 text-[10px] font-normal lg:inline-flex">
              {KIND_LABEL[row.kind] ?? row.kind}
            </Badge>
            <span className="shrink-0 text-xs text-muted-foreground">{row.products} prod.</span>
          </div>
          {/* Dual mini-bar: revenue (green) above, cost (orange) below */}
          <div className="hidden flex-col gap-1 sm:flex">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${Math.round((row.revenue / maxActivity) * 100)}%` }}
              />
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-4"
                style={{ width: `${Math.round((row.cost / maxActivity) * 100)}%` }}
              />
            </div>
          </div>
          <span
            className={cn(
              "text-end font-mono text-xs tabular-nums",
              row.revenue === 0 && "text-muted-foreground",
            )}
          >
            {row.revenue > 0 ? formatMoney(row.revenue) : "—"}
          </span>
          <span
            className={cn(
              "text-end font-mono text-xs tabular-nums",
              row.cost === 0 && "text-muted-foreground",
            )}
          >
            {row.cost > 0 ? formatMoney(row.cost) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
