"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/format";

export interface TrendChartPoint {
  month: string;
  revenue: number;
  ma3: number | null;
}

const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  ma3: { label: "3-month average", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function TrendChart({
  data,
  forecast,
}: {
  data: TrendChartPoint[];
  forecast: number | null;
}) {
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="ma3"
          type="monotone"
          stroke="var(--color-ma3)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        {forecast !== null ? (
          <ReferenceLine
            y={forecast}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 6"
            label={{
              value: `naive forecast ${formatMoneyCompact(forecast)}`,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
