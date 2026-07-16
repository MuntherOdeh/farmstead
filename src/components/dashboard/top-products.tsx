import { formatMoney } from "@/lib/format";
import type { TopProduct } from "@/lib/demo/overview";

export function TopProducts({ data }: { data: TopProduct[] }) {
  const max = Math.max(...data.map((product) => product.revenue));
  return (
    <ol className="flex flex-col gap-3">
      {data.map((product) => (
        <li key={product.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{product.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {formatMoney(product.revenue)} · {product.marginPct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.round((product.revenue / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
