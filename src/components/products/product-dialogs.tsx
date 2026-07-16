"use client";

import Decimal from "decimal.js";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { adjustStock, bulkPriceChange, bulkReassignCategory } from "@/lib/products/actions";
import type { CategoryOption, ProductRow } from "@/lib/products/queries";

function parseDecimal(value: string): Decimal | null {
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export function AdjustStockDialog({
  product,
  onOpenChange,
  onDone,
}: {
  product: ProductRow | null;
  onOpenChange: (open: boolean) => void;
  onDone: (productId: string, newQty: string) => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the fields when a different product opens (derive-during-render).
  const [prevProduct, setPrevProduct] = useState(product);
  if (prevProduct !== product) {
    setPrevProduct(product);
    if (product) {
      setDelta("");
      setReason("");
    }
  }

  const parsed = delta === "" ? null : parseDecimal(delta);
  const next =
    product && parsed !== null ? new Decimal(product.stockQty).plus(parsed) : null;

  async function submit() {
    if (!product) return;
    setSaving(true);
    const result = await adjustStock({ productId: product.id, delta, reason });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Stock adjusted — now ${new Decimal(result.data.newQty).toFixed(0)} ${product.unitCode}.`);
    onDone(product.id, result.data.newQty);
    onOpenChange(false);
  }

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name} — currently ${new Decimal(product.stockQty).toFixed(0)} ${product.unitCode}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-delta">Change (use − to remove)</Label>
            <Input
              id="adj-delta"
              inputMode="decimal"
              placeholder="e.g. 12 or -3"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
            />
            {next !== null && product ? (
              <p className={next.isNegative() ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                {next.isNegative()
                  ? "Stock can't go below zero."
                  : `New stock: ${next.toFixed(0)} ${product.unitCode}`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input
              id="adj-reason"
              placeholder="e.g. stocktake correction, spoilage"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button
            onClick={() => void submit()}
            disabled={
              saving ||
              parsed === null ||
              parsed.isZero() ||
              reason.trim().length < 3 ||
              (next !== null && next.isNegative())
            }
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply adjustment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkPriceDialog({
  rows,
  onOpenChange,
  onDone,
}: {
  rows: ProductRow[] | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [field, setField] = useState<"unitPrice" | "costPrice">("unitPrice");
  const [mode, setMode] = useState<"percent" | "absolute">("percent");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!rows) return;
    setSaving(true);
    const result = await bulkPriceChange({
      ids: rows.map((row) => row.id),
      field,
      mode,
      value,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Updated ${result.data.updated} product${result.data.updated === 1 ? "" : "s"}.`);
    setValue("");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={rows !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bulk price change</DialogTitle>
          <DialogDescription>
            Applies to {rows?.length ?? 0} selected product{rows?.length === 1 ? "" : "s"}.
            Products without a price are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Which price</Label>
            <Select value={field} onValueChange={(v) => setField(v as typeof field)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unitPrice">Selling price</SelectItem>
                <SelectItem value="costPrice">Cost price</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>How</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(v) => {
                if (v) setMode(v as typeof mode);
              }}
              className="w-fit"
            >
              <ToggleGroupItem value="percent" className="px-4">
                Percent %
              </ToggleGroupItem>
              <ToggleGroupItem value="absolute" className="px-4">
                Amount ±
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bp-value">{mode === "percent" ? "Change in %" : "Change amount"}</Label>
            <Input
              id="bp-value"
              inputMode="decimal"
              placeholder={mode === "percent" ? "e.g. 5 or -10" : "e.g. 1.50 or -0.25"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button
            onClick={() => void submit()}
            disabled={saving || parseDecimal(value) === null}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply to {rows?.length ?? 0}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkCategoryDialog({
  rows,
  categories,
  onOpenChange,
  onDone,
}: {
  rows: ProductRow[] | null;
  categories: CategoryOption[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!rows || !categoryId) return;
    setSaving(true);
    const result = await bulkReassignCategory({ ids: rows.map((row) => row.id), categoryId });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Category reassigned.");
    onDone();
    onOpenChange(false);
  }

  return (
    <Dialog open={rows !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign category</DialogTitle>
          <DialogDescription>
            Move {rows?.length ?? 0} product{rows?.length === 1 ? "" : "s"} to another category.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void submit()} disabled={saving || !categoryId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Move products
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
