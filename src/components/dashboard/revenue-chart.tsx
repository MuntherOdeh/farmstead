"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/format";
import type { MonthPoint } from "@/lib/demo/overview";

const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  costs: { label: "Costs", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function RevenueChart({ data }: { data: MonthPoint[] }) {
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fill-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fill-costs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-costs)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-costs)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={52}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          fill="url(#fill-revenue)"
        />
        <Area
          dataKey="costs"
          type="monotone"
          stroke="var(--color-costs)"
          strokeWidth={2}
          fill="url(#fill-costs)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
