"use client";

import {
  Download,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  MoreHorizontal,
  Pin,
  PinOff,
  Rows3,
  Shapes,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WidgetChart } from "@/components/data/widget-chart";
import { widgetToCsv, widgetToPng } from "@/lib/dashboard/export";
import type { WidgetKind, WidgetSpec } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<WidgetKind, string> = {
  timeseries: "Line over time",
  "ranked-bar": "Ranked bars",
  donut: "Donut",
  "stacked-bar": "Stacked bars",
  scatter: "Scatter",
  kpi: "KPI + distribution",
  histogram: "Histogram",
  "small-multiples": "Small multiples",
};

interface WidgetCardProps {
  widget: WidgetSpec;
  kind: WidgetKind;
  pinned: boolean;
  canReorder: boolean;
  onKindChange: (kind: WidgetKind) => void;
  onPinToggle: () => void;
  onHide: () => void;
  onViewRows: (label: string | null) => void;
  onDragStart: () => void;
  onDropOn: () => void;
}

export function WidgetCard({
  widget,
  kind,
  pinned,
  canReorder,
  onKindChange,
  onPinToggle,
  onHide,
  onViewRows,
  onDragStart,
  onDropOn,
}: WidgetCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  async function exportPng() {
    if (!chartRef.current) return;
    const ok = await widgetToPng(chartRef.current, widget.title);
    if (!ok) toast.error("This widget has no chart to export.");
  }

  return (
    <Card
      draggable={canReorder}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn();
      }}
      className={cn("group", pinned && "border-ring/60")}
    >
      <CardHeader className="flex-row items-start gap-2">
        {canReorder ? (
          <GripVertical
            aria-hidden
            className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 truncate text-base">
            {pinned ? <Pin className="size-3.5 shrink-0 text-muted-foreground" /> : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate">{widget.title}</span>
              </TooltipTrigger>
              <TooltipContent>
                From columns: {widget.sourceColumns.join(", ")}
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription className="truncate">{widget.subtitle}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          {widget.sourceColumns.map((columnName) => (
            <Badge key={columnName} variant="outline" className="hidden font-mono text-[10px] lg:inline-flex">
              {columnName}
            </Badge>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Widget options for {widget.title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => onViewRows(null)}>
                <Rows3 className="size-4" /> View underlying rows
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onPinToggle}>
                {pinned ? (
                  <>
                    <PinOff className="size-4" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="size-4" /> Pin to top
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onHide}>
                <EyeOff className="size-4" /> Hide
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <Shapes className="size-3.5" /> Chart type
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={kind}
                onValueChange={(value) => onKindChange(value as WidgetKind)}
              >
                {widget.compatibleKinds.map((candidate) => (
                  <DropdownMenuRadioItem key={candidate} value={candidate}>
                    {KIND_LABEL[candidate]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => widgetToCsv(widget)}>
                <Download className="size-4" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportPng()}>
                <ImageIcon className="size-4" /> Export PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <WidgetChart widget={widget} kind={kind} onSelectLabel={(label) => onViewRows(label)} />
      </CardContent>
    </Card>
  );
}
