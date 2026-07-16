"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { WidgetKind, WidgetSpec } from "@/lib/dashboard/widgets";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function configFor(widget: WidgetSpec): ChartConfig {
  const config: ChartConfig = {};
  widget.seriesKeys.forEach((key, index) => {
    config[key] = { label: key, color: PALETTE[index % PALETTE.length] };
  });
  return config;
}

export function WidgetChart({
  widget,
  kind,
  onSelectLabel,
}: {
  widget: WidgetSpec;
  kind: WidgetKind;
  onSelectLabel: (label: string) => void;
}) {
  const config = configFor(widget);
  const primary = widget.seriesKeys[0];

  switch (kind) {
    case "timeseries":
      return (
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart data={widget.data} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey={primary}
              type="monotone"
              stroke={`var(--color-${primary})`}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 5,
                onClick: (_e, payload) => {
                  const label = (payload as { payload?: { label?: string } }).payload?.label;
                  if (label) onSelectLabel(label);
                },
              }}
            />
          </LineChart>
        </ChartContainer>
      );

    case "ranked-bar":
      return (
        <ChartContainer
          config={config}
          className="w-full"
          style={{ height: Math.max(180, widget.data.length * 30 + 40) }}
        >
          <BarChart data={widget.data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={120}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey={primary}
              fill={`var(--color-${primary})`}
              radius={[0, 4, 4, 0]}
              onClick={(data) => {
                const label = (data as { label?: string }).label;
                if (label) onSelectLabel(label);
              }}
            />
          </BarChart>
        </ChartContainer>
      );

    case "donut": {
      const data = widget.data.map((point, index) => ({
        ...point,
        fill: PALETTE[index % PALETTE.length],
      }));
      const donutConfig: ChartConfig = { ...config };
      for (const point of widget.data) {
        donutConfig[String(point.label)] = { label: String(point.label) };
      }
      return (
        <ChartContainer config={donutConfig} className="mx-auto aspect-square max-h-64 w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie
              data={data}
              dataKey={primary}
              nameKey="label"
              innerRadius={52}
              paddingAngle={1.5}
              strokeWidth={2}
              stroke="var(--card)"
              onClick={(entry) => {
                const label = (entry as { label?: string }).label;
                if (label) onSelectLabel(label);
              }}
            />
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      );
    }

    case "stacked-bar":
      return (
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={widget.data} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {widget.seriesKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stack"
                fill={PALETTE[index % PALETTE.length]}
                radius={index === widget.seriesKeys.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
      );

    case "scatter":
      return (
        <ChartContainer config={{ y: { label: "y", color: PALETTE[0] } }} className="h-64 w-full">
          <ScatterChart margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" dataKey="x" tickLine={false} axisLine={false} name={widget.sourceColumns[0]} />
            <YAxis type="number" dataKey="y" tickLine={false} axisLine={false} width={48} name={widget.sourceColumns[1]} />
            <ZAxis range={[40, 41]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Scatter
              data={widget.data}
              fill={PALETTE[0]}
              fillOpacity={0.7}
              onClick={(entry) => {
                const label = (entry as { label?: string }).label;
                if (label) onSelectLabel(label);
              }}
            />
          </ScatterChart>
        </ChartContainer>
      );

    case "small-multiples":
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {widget.seriesKeys.map((key, index) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectLabel(key)}
              className="rounded-lg border p-2 text-start transition-colors hover:bg-muted/40"
            >
              <p className="mb-1 truncate text-xs font-medium">{key}</p>
              <ChartContainer
                config={{ [key]: { label: key, color: PALETTE[index % PALETTE.length] } }}
                className="h-16 w-full"
              >
                <LineChart data={widget.data}>
                  <Line
                    dataKey={key}
                    type="monotone"
                    stroke={PALETTE[index % PALETTE.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </button>
          ))}
        </div>
      );

    case "kpi":
    case "histogram":
      return (
        <div className="flex flex-col gap-3">
          {widget.kpi && kind === "kpi" ? (
            <div className="kpi flex items-baseline gap-4">
              <p className="font-heading text-3xl font-semibold tracking-tight">
                {Number(widget.kpi.value).toLocaleString("en-GB")}
              </p>
              <p className="text-sm text-muted-foreground">
                {widget.kpi.count} rows · mean {Number(widget.kpi.mean).toLocaleString("en-GB")}
              </p>
            </div>
          ) : null}
          <ChartContainer config={config} className="h-32 w-full">
            <BarChart data={widget.data} margin={{ left: 8, right: 8 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill={PALETTE[0]}
                radius={[3, 3, 0, 0]}
                onClick={(data) => {
                  const label = (data as { label?: string }).label;
                  if (label) onSelectLabel(label);
                }}
              />
            </BarChart>
          </ChartContainer>
        </div>
      );

    default:
      return null;
  }
}
