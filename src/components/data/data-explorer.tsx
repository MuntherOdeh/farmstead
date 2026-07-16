"use client";

import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type GroupingState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ImportMapping } from "@/lib/import/types";

export interface ExplorerRow {
  rowIndex: number;
  raw: Record<string, unknown>;
}

export function DataExplorer({
  rows,
  mapping,
}: {
  rows: ExplorerRow[];
  mapping: ImportMapping;
}) {
  const headers = useMemo(
    () => mapping.columns.filter((column) => column.include).map((column) => column.header),
    [mapping],
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [view, setView] = useState<"table" | "text">("table");

  const columns = useMemo<ColumnDef<ExplorerRow>[]>(
    () => [
      {
        id: "#",
        accessorFn: (row) => row.rowIndex + 2,
        header: "#",
        size: 56,
        enableGrouping: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.rowIndex + 2}
          </span>
        ),
      },
      ...headers.map(
        (header): ColumnDef<ExplorerRow> => ({
          id: header,
          accessorFn: (row) => {
            const value = row.raw[header];
            return value === null || value === undefined ? "" : String(value);
          },
          header,
          aggregationFn: "count",
          cell: ({ getValue }) => {
            const value = getValue<string>();
            return value === "" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="block max-w-48 truncate">{value}</span>
            );
          },
          aggregatedCell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground">{getValue<number>()} rows</span>
          ),
        }),
      ),
    ],
    [headers],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnVisibility, grouping },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    globalFilterFn: (row, _columnId, value: string) =>
      rankItem(headers.map((header) => String(row.original.raw[header] ?? "")).join(" "), value)
        .passed,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
    getRowId: (row, index) => `${row.rowIndex}-${index}`,
  });

  const tableRows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 41,
    overscan: 16,
  });
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Filter rows…"
            className="w-52 ps-8"
          />
        </div>
        <Select
          value={grouping[0] ?? "none"}
          onValueChange={(value) => setGrouping(value === "none" ? [] : [value])}
        >
          <SelectTrigger className="w-44" size="sm">
            <SelectValue placeholder="Group by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            {headers.map((header) => (
              <SelectItem key={header} value={header}>
                Group by {header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ms-auto flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as "table" | "text");
            }}
          >
            <ToggleGroupItem value="table" className="px-3">Table</ToggleGroupItem>
            <ToggleGroupItem value="text" className="px-3">Text</ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {view === "text" ? (
        <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5">
            {tableRows
              .filter((row) => !row.getIsGrouped())
              .slice(0, 500)
              .map((row) =>
                headers
                  .filter((header) => table.getColumn(header)?.getIsVisible())
                  .map((header) => `${header}: ${String(row.original.raw[header] ?? "—")}`)
                  .join("  ·  "),
              )
              .join("\n")}
          </pre>
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[60vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {virtualItems.length > 0 && <tr style={{ height: virtualItems[0].start }} />}
              {virtualItems.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                return (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {cell.getIsGrouped() ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ms-2 h-7"
                            onClick={row.getToggleExpandedHandler()}
                          >
                            {row.getIsExpanded() ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            <span className="text-xs text-muted-foreground">
                              ({row.subRows.length})
                            </span>
                          </Button>
                        ) : cell.getIsAggregated() ? (
                          flexRender(cell.column.columnDef.aggregatedCell, cell.getContext())
                        ) : cell.getIsPlaceholder() ? null : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              <tr
                style={{
                  height: virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0),
                }}
              />
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {tableRows.filter((row) => !row.getIsGrouped()).length} rows
        {globalFilter ? " (filtered)" : ""} — the table is the ground truth; charts are the headline.
      </p>
    </div>
  );
}
