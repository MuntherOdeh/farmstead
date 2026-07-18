"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/format";

// For ledgers without dates a time series is meaningless — show the money
// story instead: revenue vs each cost bucket, side by side.

export interface ComparisonBar {
  label: string;
  value: number;
  colorVar: string; // e.g. "var(--chart-1)"
}

export function ComparisonChart({ data }: { data: ComparisonBar[] }) {
  const config: ChartConfig = { value: { label: "Amount" } };
  const chartData = data.map((bar) => ({ ...bar, fill: bar.colorVar }));
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72} isAnimationActive={false}>
          {chartData.map((bar) => (
            <Cell key={bar.label} fill={bar.colorVar} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
