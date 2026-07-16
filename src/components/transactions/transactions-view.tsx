"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { Download, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/transactions/actions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TxRow {
  id: string;
  type: string;
  occurredOn: string;
  productName: string;
  categoryName: string;
  partyName: string | null;
  qty: string;
  unitCode: string | null;
  unitPrice: string | null;
  total: string | null;
  source: string;
  notes: string | null;
}

const TYPES = ["sale", "purchase", "birth", "death", "consumption", "adjustment", "expense"];

const TYPE_DOT: Record<string, string> = {
  sale: "bg-chart-1",
  purchase: "bg-chart-3",
  birth: "bg-chart-2",
  death: "bg-destructive",
  consumption: "bg-chart-5",
  adjustment: "bg-muted-foreground",
  expense: "bg-chart-4",
};

export function TransactionsView({ rows, canEdit }: { rows: TxRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<TxRow | null>(null);

  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.categoryName))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (categoryFilter !== "all" && row.categoryName !== categoryFilter) return false;
      if (from && row.occurredOn < from) return false;
      if (to && row.occurredOn > to) return false;
      if (query) {
        const haystack =
          `${row.productName} ${row.partyName ?? ""} ${row.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, categoryFilter, from, to]);

  const totals = useMemo(() => {
    let revenue = new Decimal(0);
    let spend = new Decimal(0);
    for (const row of filtered) {
      if (row.type === "sale") revenue = revenue.plus(row.total ?? 0);
      if (row.type === "purchase" || row.type === "expense") spend = spend.plus(row.total ?? 0);
    }
    return { revenue, spend };
  }, [filtered]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 20,
  });
  const virtualItems = virtualizer.getVirtualItems();

  function exportXlsx() {
    const sheetRows = filtered.map((row) => ({
      Date: row.occurredOn,
      Type: row.type,
      Product: row.productName,
      Category: row.categoryName,
      Party: row.partyName ?? "",
      Qty: Number(new Decimal(row.qty).toFixed(2)),
      Unit: row.unitCode ?? "",
      "Unit price": row.unitPrice ? Number(new Decimal(row.unitPrice).toFixed(2)) : null,
      Total: row.total ? Number(new Decimal(row.total).toFixed(2)) : null,
      Source: row.source,
      Notes: row.notes ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Transactions");
    XLSX.writeFile(book, "transactions.xlsx");
    toast.success(`Exported ${sheetRows.length} rows.`);
  }

  async function remove(row: TxRow) {
    const result = await softDeleteTransaction(row.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast(`Deleted ${row.type} of ${row.productName}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          void restoreTransaction(row.id).then((restored) => {
            if (restored.ok) router.refresh();
            else toast.error(restored.error);
          });
        },
      },
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, party or note…"
            className="w-56 ps-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="w-36"
          aria-label="From date"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="w-36"
          aria-label="To date"
        />
        <Button variant="outline" size="sm" className="ms-auto" onClick={exportXlsx}>
          <Download className="size-4" /> Export
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" className="font-mono">{filtered.length} rows</Badge>
        <Badge variant="outline" className="font-mono">
          revenue {formatMoney(Number(totals.revenue.toFixed(0)))}
        </Badge>
        <Badge variant="outline" className="font-mono">
          spend {formatMoney(Number(totals.spend.toFixed(0)))}
        </Badge>
      </div>

      <div ref={scrollRef} className="max-h-[65vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">Party</TableHead>
              <TableHead className="text-end">Qty</TableHead>
              <TableHead className="hidden text-end sm:table-cell">Price</TableHead>
              <TableHead className="text-end">Total</TableHead>
              {canEdit ? <TableHead className="w-20" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {virtualItems.length > 0 && <tr style={{ height: virtualItems[0].start }} />}
            {virtualItems.map((virtualRow) => {
              const row = filtered[virtualRow.index];
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {format(parseISO(row.occurredOn), "d MMM yy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5 font-normal capitalize">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", TYPE_DOT[row.type])}
                      />
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-44 truncate">{row.productName}</TableCell>
                  <TableCell className="hidden max-w-36 truncate text-muted-foreground md:table-cell">
                    {row.partyName ?? "—"}
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs">
                    {new Decimal(row.qty).toFixed(0)} {row.unitCode ?? ""}
                  </TableCell>
                  <TableCell className="hidden text-end font-mono text-xs sm:table-cell">
                    {row.unitPrice ? formatMoney(Number(new Decimal(row.unitPrice).toFixed(2))) : "—"}
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs">
                    {row.total ? formatMoney(Number(new Decimal(row.total).toFixed(2))) : "—"}
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(row)}
                          aria-label={`Edit ${row.type} of ${row.productName}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void remove(row)}
                          aria-label={`Delete ${row.type} of ${row.productName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
            <tr
              style={{ height: virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0) }}
            />
          </TableBody>
        </Table>
      </div>

      <EditDialog
        row={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function EditDialog({
  row,
  onOpenChange,
  onSaved,
}: {
  row: TxRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ occurredOn: "", qty: "", unitPrice: "", total: "", notes: "" });

  const [prevRow, setPrevRow] = useState(row);
  if (prevRow !== row) {
    setPrevRow(row);
    if (row) {
      setValues({
        occurredOn: row.occurredOn,
        qty: new Decimal(row.qty).toString(),
        unitPrice: row.unitPrice ? new Decimal(row.unitPrice).toString() : "",
        total: row.total ? new Decimal(row.total).toString() : "",
        notes: row.notes ?? "",
      });
    }
  }

  async function save() {
    if (!row) return;
    setSaving(true);
    const result = await updateTransaction(row.id, values);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction updated.");
    onSaved();
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>
            {row ? `${row.type} · ${row.productName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input
              id="tx-date"
              type="date"
              value={values.occurredOn}
              onChange={(event) => setValues((v) => ({ ...v, occurredOn: event.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-qty">Qty</Label>
              <Input
                id="tx-qty"
                inputMode="decimal"
                value={values.qty}
                onChange={(event) => setValues((v) => ({ ...v, qty: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-price">Unit price</Label>
              <Input
                id="tx-price"
                inputMode="decimal"
                value={values.unitPrice}
                onChange={(event) => setValues((v) => ({ ...v, unitPrice: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-total">Total</Label>
              <Input
                id="tx-total"
                inputMode="decimal"
                value={values.total}
                onChange={(event) => setValues((v) => ({ ...v, total: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-notes">Notes</Label>
            <Input
              id="tx-notes"
              value={values.notes}
              onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
            />
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
