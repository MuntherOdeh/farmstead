import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDeltaPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
}

export function KpiCard({ label, value, delta, deltaLabel }: KpiCardProps) {
  const Trend = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card className="kpi">
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-3xl font-semibold tracking-tight">{value}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Trend aria-hidden className="size-3.5" />
          <span>{formatDeltaPct(delta)}</span>
          <span>·</span>
          <span>{deltaLabel}</span>
        </p>
      </CardContent>
    </Card>
  );
}
