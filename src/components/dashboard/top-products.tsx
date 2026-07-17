import { formatMoney } from "@/lib/format";

export interface RankedItem {
  name: string;
  revenue: number;
  /** Shown after the amount when present (e.g. margin %). */
  marginPct?: number;
  /** Small trailing hint, e.g. the item's category. */
  hint?: string;
}

export function TopProducts({
  data,
  barClass = "bg-chart-1",
}: {
  data: RankedItem[];
  barClass?: string;
}) {
  const max = Math.max(...data.map((product) => product.revenue), 1);
  return (
    <ol className="flex flex-col gap-3">
      {data.map((product) => (
        <li key={product.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">
              {product.name}
              {product.hint ? (
                <span className="ms-2 text-xs text-muted-foreground">{product.hint}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {formatMoney(product.revenue)}
              {product.marginPct !== undefined ? ` · ${product.marginPct}%` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.round((product.revenue / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
