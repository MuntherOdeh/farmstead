"use client";

import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import Decimal from "decimal.js";
import { format } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Bookmark,
  ChevronDown,
  Copy,
  Download,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePreferences } from "@/components/theme/theme-provider";
import { formatMoney } from "@/lib/format";
import { productCalc } from "@/lib/products/calc";
import type { CategoryOption, ProductRow } from "@/lib/products/queries";
import { cn } from "@/lib/utils";

const VIRTUALIZE_ABOVE = 500;
const VIEWS_STORAGE_KEY = "farmstead-product-views";

interface SavedView {
  name: string;
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
}

function readViews(): SavedView[] {
  try {
    const raw = window.localStorage.getItem(VIEWS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

const fuzzyFilter: FilterFn<ProductRow> = (row, _columnId, value: string) => {
  const haystack = [
    row.original.name,
    row.original.sku ?? "",
    row.original.categoryName,
    row.original.species ?? "",
    row.original.breed ?? "",
    row.original.tags?.join(" ") ?? "",
  ].join(" ");
  return rankItem(haystack, value).passed;
};

export interface ProductsTableProps {
  rows: ProductRow[];
  categories: CategoryOption[];
  canEdit: boolean;
  onNew: () => void;
  onEdit: (row: ProductRow) => void;
  onDuplicate: (row: ProductRow) => void;
  onAdjust: (row: ProductRow) => void;
  onArchiveToggle: (rows: ProductRow[], archived: boolean) => void;
  onDelete: (row: ProductRow) => void;
  onBulkPrice: (rows: ProductRow[]) => void;
  onBulkCategory: (rows: ProductRow[]) => void;
  onExport: (rows: ProductRow[]) => void;
}

const displayMoney = (value: string | null) =>
  value === null ? "—" : formatMoney(Number(new Decimal(value).toFixed(2)));

export function ProductsTable({
  rows,
  categories,
  canEdit,
  onNew,
  onEdit,
  onDuplicate,
  onAdjust,
  onArchiveToggle,
  onDelete,
  onBulkPrice,
  onBulkCategory,
  onExport,
}: ProductsTableProps) {
  const { density } = usePreferences();
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    updatedAt: false,
    costPrice: false,
  });
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [viewsVersion, setViewsVersion] = useState(0);

  const views = useSyncExternalStore(
    () => () => {},
    () => JSON.stringify(readViews()),
    () => "[]",
  );
  const savedViews = useMemo(() => JSON.parse(views) as SavedView[], [views]);
  void viewsVersion;

  const columns = useMemo<ColumnDef<ProductRow>[]>(() => {
    const defs: ColumnDef<ProductRow>[] = [
      {
        id: "select",
        size: 32,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(!!checked)}
            aria-label={`Select ${row.original.name}`}
          />
        ),
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/products/${row.original.id}`}
              className="truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {row.original.sku ?? "no sku"}
              {row.original.breed ? ` · ${row.original.breed}` : ""}
            </span>
          </div>
        ),
      },
      {
        id: "category",
        accessorKey: "categoryName",
        filterFn: "equals",
        header: "Category",
        cell: ({ row }) => <Badge variant="secondary">{row.original.categoryName}</Badge>,
      },
      {
        id: "stock",
        accessorFn: (row) => Number(row.stockQty),
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Stock <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const { stockQty, reorderLevel, unitCode } = row.original;
          const low =
            reorderLevel !== null && new Decimal(stockQty).lt(new Decimal(reorderLevel));
          return (
            <span className="flex items-center gap-1.5 font-mono text-sm">
              {low ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span aria-label="Below reorder level" className="size-2 rounded-full bg-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Below reorder level ({new Decimal(reorderLevel!).toFixed(0)})
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {new Decimal(stockQty).toFixed(0)}
              <span className="text-xs text-muted-foreground">{unitCode}</span>
            </span>
          );
        },
      },
      {
        id: "unitPrice",
        accessorFn: (row) => (row.unitPrice === null ? -1 : Number(row.unitPrice)),
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Price <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{displayMoney(row.original.unitPrice)}</span>
        ),
      },
      {
        id: "costPrice",
        accessorFn: (row) => (row.costPrice === null ? -1 : Number(row.costPrice)),
        header: "Cost",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{displayMoney(row.original.costPrice)}</span>
        ),
      },
      {
        id: "margin",
        accessorFn: (row) => {
          const calc = productCalc(row);
          return calc.marginPct === null ? -1000 : Number(calc.marginPct);
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Margin <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const calc = productCalc(row.original);
          return (
            <span className="font-mono text-sm">
              {calc.marginPct === null ? "—" : `${calc.marginPct}%`}
            </span>
          );
        },
      },
      {
        id: "status",
        accessorFn: (row) => (row.isActive ? "active" : "archived"),
        filterFn: "equals",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="outline">Active</Badge>
          ) : (
            <Badge variant="secondary">Archived</Badge>
          ),
      },
      {
        id: "updatedAt",
        accessorFn: (row) => row.updatedAt.getTime(),
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {format(row.original.updatedAt, "d MMM yy")}
          </span>
        ),
      },
    ];

    if (canEdit) {
      defs.push({
        id: "actions",
        size: 40,
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions for {row.original.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(row.original)}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicate(row.original)}>
                <Copy className="size-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdjust(row.original)}>
                <Scale className="size-4" /> Adjust stock
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onArchiveToggle([row.original], row.original.isActive)}
              >
                {row.original.isActive ? (
                  <>
                    <Archive className="size-4" /> Archive
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="size-4" /> Unarchive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row.original)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }
    return defs;
  }, [canEdit, onAdjust, onArchiveToggle, onDelete, onDuplicate, onEdit]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    getRowId: (row) => row.id,
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const virtualized = filteredRows.length > VIRTUALIZE_ABOVE;
  const displayRows = virtualized
    ? table.getSortedRowModel().rows
    : table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: virtualized ? displayRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (density === "compact" ? 40 : 53),
    overscan: 12,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const categoryFilter = (table.getColumn("category")?.getFilterValue() as string) ?? "";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "";

  function saveCurrentView() {
    const name = window.prompt("Name this view:");
    if (!name?.trim()) return;
    const next: SavedView[] = [
      ...readViews().filter((view) => view.name !== name.trim()),
      { name: name.trim(), sorting, columnVisibility, columnFilters, globalFilter },
    ];
    try {
      window.localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(next));
      setViewsVersion((v) => v + 1);
      toast.success(`View "${name.trim()}" saved.`);
    } catch {
      toast.error("Couldn't save the view (storage unavailable).");
    }
  }

  function applyView(view: SavedView) {
    setSorting(view.sorting);
    setColumnVisibility(view.columnVisibility);
    setColumnFilters(view.columnFilters);
    setGlobalFilter(view.globalFilter);
  }

  function deleteView(name: string) {
    try {
      window.localStorage.setItem(
        VIEWS_STORAGE_KEY,
        JSON.stringify(readViews().filter((view) => view.name !== name)),
      );
      setViewsVersion((v) => v + 1);
    } catch {
      // storage unavailable — nothing to delete
    }
  }

  const cellPadding = density === "compact" ? "py-1.5" : "py-3";

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search products…"
            className="w-56 ps-8"
            data-products-search
          />
        </div>
        <Select
          value={categoryFilter === "" ? "all" : categoryFilter}
          onValueChange={(value) =>
            table.getColumn("category")?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter === "" ? "all" : statusFilter}
          onValueChange={(value) =>
            table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bookmark className="size-4" /> Views <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={saveCurrentView}>Save current view…</DropdownMenuItem>
              {savedViews.length > 0 ? <DropdownMenuSeparator /> : null}
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.name}
                  onSelect={() => applyView(view)}
                  className="justify-between"
                >
                  {view.name}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteView(view.name);
                    }}
                    aria-label={`Delete view ${view.name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                    className="capitalize"
                  >
                    {column.id === "unitPrice"
                      ? "Price"
                      : column.id === "costPrice"
                        ? "Cost"
                        : column.id === "updatedAt"
                          ? "Updated"
                          : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(filteredRows.map((row) => row.original))}
          >
            <Download className="size-4" /> Export
          </Button>
          {canEdit ? (
            <Button size="sm" onClick={onNew}>
              <PackagePlus className="size-4" /> New product
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bulk bar */}
      {selectedRows.length > 0 && canEdit ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedRows.length} selected</span>
          <Button variant="outline" size="sm" onClick={() => onBulkPrice(selectedRows)}>
            Change prices
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBulkCategory(selectedRows)}>
            Reassign category
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onArchiveToggle(selectedRows, true)}
          >
            <Archive className="size-4" /> Archive
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport(selectedRows)}>
            <Download className="size-4" /> Export selection
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => table.resetRowSelection()}
          >
            Clear
          </Button>
        </div>
      ) : null}

      {/* Table */}
      {filteredRows.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>No products match</EmptyTitle>
            <EmptyDescription>
              {rows.length === 0
                ? "Create your first product to get started."
                : "Try clearing the search or filters."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          ref={scrollRef}
          className={cn("rounded-lg border", virtualized && "max-h-[70vh] overflow-auto")}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {virtualized ? (
                <>
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }} />
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = displayRows[virtualRow.index];
                    return (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className={cellPadding}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  <tr
                    style={{
                      height:
                        rowVirtualizer.getTotalSize() -
                        (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                    }}
                  />
                </>
              ) : (
                displayRows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cellPadding}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!virtualized && filteredRows.length > 0 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredRows.length} product{filteredRows.length === 1 ? "" : "s"}
            {selectedRows.length > 0 ? ` · ${selectedRows.length} selected` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
