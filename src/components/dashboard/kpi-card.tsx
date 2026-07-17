import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDeltaPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  /** When null/undefined, the delta row becomes a plain caption or nothing. */
  deltaLabel?: string | null;
  caption?: string;
  tone?: "default" | "negative";
}

export function KpiCard({ label, value, delta, deltaLabel, caption, tone }: KpiCardProps) {
  const Trend = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card className="kpi">
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={
            tone === "negative"
              ? "font-heading text-3xl font-semibold tracking-tight text-destructive"
              : "font-heading text-3xl font-semibold tracking-tight"
          }
        >
          {value}
        </p>
        {delta !== undefined && deltaLabel ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Trend aria-hidden className="size-3.5" />
            <span>{formatDeltaPct(delta)}</span>
            <span>·</span>
            <span>{deltaLabel}</span>
          </p>
        ) : caption ? (
          <p className="text-sm text-muted-foreground">{caption}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
