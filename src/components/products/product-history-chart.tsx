"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/format";

export interface MonthlyProductPoint {
  month: string;
  sold: number;
  revenue: number;
}

const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  sold: { label: "Qty sold", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ProductHistoryChart({ data }: { data: MonthlyProductPoint[] }) {
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
        <YAxis
          yAxisId="revenue"
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          fill="var(--color-revenue)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}
