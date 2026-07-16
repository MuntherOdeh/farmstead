"use client";

import Decimal from "decimal.js";
import { Download, GripVertical, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthOf } from "@/lib/analytics/calc";
import { cn } from "@/lib/utils";

// Pivot builder (SPEC §7 /analytics): drag dimensions to rows/columns and a
// measure to values — click also works, drag is the garnish.

export interface PivotRow {
  productName: string;
  categoryName: string;
  species: string | null;
  partyName: string | null;
  type: string;
  occurredOn: string;
  qty: string;
  total: string | null;
  costPrice: string | null;
}

type DimensionKey = "product" | "category" | "species" | "party" | "type" | "month";
type MeasureKey = "revenue" | "profit" | "qty" | "count";

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "category", label: "Category" },
  { key: "species", label: "Species" },
  { key: "party", label: "Party" },
  { key: "type", label: "Type" },
  { key: "month", label: "Month" },
];

const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "qty", label: "Quantity" },
  { key: "count", label: "Row count" },
];

const dimensionValue = (row: PivotRow, dimension: DimensionKey): string => {
  switch (dimension) {
    case "product":
      return row.productName;
    case "category":
      return row.categoryName;
    case "species":
      return row.species ?? "—";
    case "party":
      return row.partyName ?? "—";
    case "type":
      return row.type;
    case "month":
      return monthOf(row.occurredOn);
  }
};

const measureValue = (row: PivotRow, measure: MeasureKey): Decimal => {
  switch (measure) {
    case "revenue":
      return row.type === "sale" ? new Decimal(row.total ?? 0) : new Decimal(0);
    case "profit":
      return row.type === "sale"
        ? new Decimal(row.total ?? 0).minus(new Decimal(row.qty).mul(row.costPrice ?? 0))
        : new Decimal(0);
    case "qty":
      return new Decimal(row.qty);
    case "count":
      return new Decimal(1);
  }
};

function Chip({
  label,
  onRemove,
  draggableId,
  onDragStart,
}: {
  label: string;
  onRemove?: () => void;
  draggableId: string;
  onDragStart: (id: string) => void;
}) {
  return (
    <Badge
      variant="secondary"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(draggableId);
      }}
      className="cursor-grab gap-1 py-1 ps-1.5"
    >
      <GripVertical className="size-3 opacity-60" />
      {label}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>
          <X className="size-3" />
        </button>
      ) : null}
    </Badge>
  );
}

function DropZone({
  title,
  children,
  onDropId,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  onDropId: (id: string) => void;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  const dragData = useRef<string | null>(null);
  void dragData;
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData("text/plain") || pendingDragId;
        if (id) onDropId(id);
      }}
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5",
        over && "border-ring bg-accent/40",
      )}
    >
      <span className="me-1 text-xs font-medium text-muted-foreground">{title}</span>
      {children}
      {!children || (Array.isArray(children) && children.length === 0) ? (
        <span className="text-xs text-muted-foreground/60">{hint}</span>
      ) : null}
    </div>
  );
}

// HTML5 dnd on some browsers loses dataTransfer in drop unless set — keep a
// module-level fallback for the id being dragged.
let pendingDragId: string | null = null;

export function PivotBuilder({ rows }: { rows: PivotRow[] }) {
  const [rowDim, setRowDim] = useState<DimensionKey>("category");
  const [colDim, setColDim] = useState<DimensionKey | null>("month");
  const [measure, setMeasure] = useState<MeasureKey>("revenue");

  const handleDragStart = (id: string) => {
    pendingDragId = id;
  };

  const assign = (zone: "rows" | "cols" | "values") => (id: string) => {
    pendingDragId = null;
    if (id.startsWith("m:")) {
      if (zone === "values") setMeasure(id.slice(2) as MeasureKey);
      return;
    }
    const dimension = id.slice(2) as DimensionKey;
    if (zone === "rows") {
      if (colDim === dimension) setColDim(null);
      setRowDim(dimension);
    } else if (zone === "cols") {
      if (rowDim === dimension) setRowDim(colDim ?? "category");
      setColDim(dimension);
    }
  };

  const pivot = useMemo(() => {
    const rowKeys = new Set<string>();
    const colKeys = new Set<string>();
    const cells = new Map<string, Decimal>();
    for (const row of rows) {
      const r = dimensionValue(row, rowDim);
      const c = colDim ? dimensionValue(row, colDim) : "Value";
      rowKeys.add(r);
      colKeys.add(c);
      const key = `${r}¦${c}`;
      cells.set(key, (cells.get(key) ?? new Decimal(0)).plus(measureValue(row, measure)));
    }
    const sortedCols = [...colKeys].sort();
    const rowTotals = new Map<string, Decimal>();
    for (const r of rowKeys) {
      rowTotals.set(
        r,
        sortedCols.reduce(
          (sum, c) => sum.plus(cells.get(`${r}¦${c}`) ?? new Decimal(0)),
          new Decimal(0),
        ),
      );
    }
    const sortedRows = [...rowKeys].sort((a, b) =>
      rowTotals.get(b)!.minus(rowTotals.get(a)!).toNumber(),
    );
    return { sortedRows: sortedRows.slice(0, 40), sortedCols: sortedCols.slice(0, 14), cells, rowTotals };
  }, [rows, rowDim, colDim, measure]);

  function exportCsv() {
    const header = [DIMENSIONS.find((d) => d.key === rowDim)!.label, ...pivot.sortedCols, "Total"];
    const lines = [header.join(",")];
    for (const r of pivot.sortedRows) {
      lines.push(
        [
          `"${r.replace(/"/g, '""')}"`,
          ...pivot.sortedCols.map((c) =>
            (pivot.cells.get(`${r}¦${c}`) ?? new Decimal(0)).toFixed(2),
          ),
          pivot.rowTotals.get(r)!.toFixed(2),
        ].join(","),
      );
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pivot-${rowDim}-${measure}.csv`;
    link.click();
  }

  const available = DIMENSIONS.filter((d) => d.key !== rowDim && d.key !== colDim);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Pivot builder</CardTitle>
          <CardDescription>
            Drag (or click) dimensions into rows and columns; pick a measure.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {available.map((dimension) => (
            <button
              key={dimension.key}
              type="button"
              onClick={() => setRowDim(dimension.key)}
              className="contents"
            >
              <Chip
                label={dimension.label}
                draggableId={`d:${dimension.key}`}
                onDragStart={handleDragStart}
              />
            </button>
          ))}
          <span className="mx-1 border-s" />
          {MEASURES.filter((m) => m.key !== measure).map((m) => (
            <button key={m.key} type="button" onClick={() => setMeasure(m.key)} className="contents">
              <Chip label={`Σ ${m.label}`} draggableId={`m:${m.key}`} onDragStart={handleDragStart} />
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <DropZone title="Rows" onDropId={assign("rows")} hint="drop a dimension">
            <Chip
              label={DIMENSIONS.find((d) => d.key === rowDim)!.label}
              draggableId={`d:${rowDim}`}
              onDragStart={handleDragStart}
            />
          </DropZone>
          <DropZone title="Columns" onDropId={assign("cols")} hint="optional">
            {colDim ? (
              <Chip
                label={DIMENSIONS.find((d) => d.key === colDim)!.label}
                draggableId={`d:${colDim}`}
                onDragStart={handleDragStart}
                onRemove={() => setColDim(null)}
              />
            ) : null}
          </DropZone>
          <DropZone title="Values" onDropId={assign("values")} hint="drop a measure">
            <Chip
              label={`Σ ${MEASURES.find((m) => m.key === measure)!.label}`}
              draggableId={`m:${measure}`}
              onDragStart={handleDragStart}
            />
          </DropZone>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-36">
                  {DIMENSIONS.find((d) => d.key === rowDim)!.label}
                </TableHead>
                {pivot.sortedCols.map((c) => (
                  <TableHead key={c} className="text-end">
                    {c}
                  </TableHead>
                ))}
                <TableHead className="text-end font-semibold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pivot.sortedRows.map((r) => (
                <TableRow key={r}>
                  <TableCell className="max-w-44 truncate font-medium">{r}</TableCell>
                  {pivot.sortedCols.map((c) => {
                    const value = pivot.cells.get(`${r}¦${c}`);
                    return (
                      <TableCell key={c} className="text-end font-mono text-xs">
                        {value && !value.isZero() ? Number(value.toFixed(0)).toLocaleString("en-GB") : "·"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-end font-mono text-xs font-semibold">
                    {Number(pivot.rowTotals.get(r)!.toFixed(0)).toLocaleString("en-GB")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
