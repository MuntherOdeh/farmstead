import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

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
// so a section with only costs (e.g. bees) is still visible. One bar per row,
// split green (revenue) + orange (cost), width proportional to total activity.
export function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const maxTotal = Math.max(...rows.map((r) => r.revenue + r.cost), 1);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="hidden text-end sm:table-cell">Products</TableHead>
            <TableHead className="w-[34%]">Revenue vs cost</TableHead>
            <TableHead className="text-end">Revenue</TableHead>
            <TableHead className="text-end">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const total = row.revenue + row.cost;
            const revPct = (row.revenue / maxTotal) * 100;
            const costPct = (row.cost / maxTotal) * 100;
            return (
              <TableRow key={row.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <bdi className="font-medium">{row.name}</bdi>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {KIND_LABEL[row.kind] ?? row.kind}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden text-end font-mono text-xs text-muted-foreground sm:table-cell">
                  {row.products}
                </TableCell>
                <TableCell>
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Revenue ${formatMoney(row.revenue)}, cost ${formatMoney(row.cost)}`}
                  >
                    {revPct > 0 ? (
                      <span className="h-full bg-chart-1" style={{ width: `${revPct}%` }} />
                    ) : null}
                    {costPct > 0 ? (
                      <span className="h-full bg-chart-4" style={{ width: `${costPct}%` }} />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-end font-mono text-xs tabular-nums">
                  {row.revenue > 0 ? (
                    <span className="text-foreground">{formatMoney(row.revenue)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-end font-mono text-xs tabular-nums">
                  {row.cost > 0 ? (
                    <span className="text-foreground">{formatMoney(row.cost)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" /> Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-4" /> Cost
        </span>
      </div>
    </div>
  );
}
