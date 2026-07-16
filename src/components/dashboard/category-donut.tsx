"use client";

import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/format";
import type { CategorySlice } from "@/lib/demo/overview";

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  // Config is derived from the data so real category names label correctly.
  const config = useMemo(() => {
    const derived: ChartConfig = { revenue: { label: "Revenue" } };
    data.forEach((slice, index) => {
      derived[slice.key] = { label: slice.label, color: `var(--chart-${index + 1})` };
    });
    return derived;
  }, [data]);

  const total = data.reduce((sum, slice) => sum + slice.revenue, 0);
  const chartData = data.map((slice) => ({
    ...slice,
    fill: `var(--color-${slice.key})`,
  }));

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
        <Pie
          data={chartData}
          dataKey="revenue"
          nameKey="key"
          innerRadius={62}
          strokeWidth={2}
          stroke="var(--card)"
          paddingAngle={1.5}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 4}
                      className="fill-foreground font-heading text-xl font-semibold"
                    >
                      {formatMoneyCompact(total)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 16}
                      className="fill-muted-foreground text-xs"
                    >
                      12 months
                    </tspan>
                  </text>
                );
              }
              return null;
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  );
}
