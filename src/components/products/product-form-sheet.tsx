"use client";

import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Path } from "react-hook-form";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CreatableCombobox } from "@/components/products/creatable-combobox";
import {
  createAttributeDef,
  createCategory,
  createProduct,
  createUnit,
  updateProduct,
} from "@/lib/products/actions";
import { productCalc } from "@/lib/products/calc";
import type {
  AttributeDefRow,
  CategoryOption,
  ProductRow,
  UnitOption,
} from "@/lib/products/queries";
import { productInputSchema } from "@/lib/products/schemas";

export interface ProductFormValues {
  name: string;
  sku: string;
  categoryId: string;
  unitId: string;
  species: string;
  breed: string;
  description: string;
  unitPrice: string;
  costPrice: string;
  stockQty: string;
  reorderLevel: string;
  attributes: Record<string, unknown>;
  tagsText: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  sku: "",
  categoryId: "",
  unitId: "",
  species: "",
  breed: "",
  description: "",
  unitPrice: "",
  costPrice: "",
  stockQty: "0",
  reorderLevel: "",
  attributes: {},
  tagsText: "",
  notes: "",
  isActive: true,
};

function valuesFromProduct(product: ProductRow): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku ?? "",
    categoryId: product.categoryId,
    unitId: product.unitId,
    species: product.species ?? "",
    breed: product.breed ?? "",
    description: product.description ?? "",
    unitPrice: product.unitPrice ?? "",
    costPrice: product.costPrice ?? "",
    stockQty: product.stockQty,
    reorderLevel: product.reorderLevel ?? "",
    attributes: product.attributes ?? {},
    tagsText: product.tags?.join(", ") ?? "",
    notes: product.notes ?? "",
    isActive: product.isActive,
  };
}

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null; // null = create
  categories: CategoryOption[];
  units: UnitOption[];
  attributeDefs: AttributeDefRow[];
  onCategoryCreated: (category: CategoryOption) => void;
  onUnitCreated: (unit: UnitOption) => void;
  onAttributeDefCreated: (def: AttributeDefRow) => void;
  onSaved: () => void;
}

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  categories,
  units,
  attributeDefs,
  onCategoryCreated,
  onUnitCreated,
  onAttributeDefCreated,
  onSaved,
}: ProductFormSheetProps) {
  const form = useForm<ProductFormValues>({ defaultValues: EMPTY_VALUES });
  const [saving, setSaving] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  useEffect(() => {
    if (open) form.reset(product ? valuesFromProduct(product) : EMPTY_VALUES);
  }, [open, product, form]);

  const categoryId = form.watch("categoryId");
  const unitPrice = form.watch("unitPrice");
  const costPrice = form.watch("costPrice");
  const stockQty = form.watch("stockQty");
  const attributes = form.watch("attributes");

  const calc = useMemo(
    () => productCalc({ unitPrice, costPrice, stockQty }),
    [unitPrice, costPrice, stockQty],
  );

  const defsForCategory = useMemo(
    () => attributeDefs.filter((def) => def.categoryId === categoryId),
    [attributeDefs, categoryId],
  );

  async function onSubmit(values: ProductFormValues) {
    const raw = {
      name: values.name,
      sku: values.sku,
      categoryId: values.categoryId,
      unitId: values.unitId,
      species: values.species,
      breed: values.breed,
      description: values.description,
      unitPrice: values.unitPrice,
      costPrice: values.costPrice,
      stockQty: values.stockQty === "" ? "0" : values.stockQty,
      reorderLevel: values.reorderLevel,
      attributes: values.attributes,
      tags: values.tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: values.notes,
      isActive: values.isActive,
    };

    const parsed = productInputSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") as Path<ProductFormValues>;
        form.setError(path, { message: issue.message });
      }
      return;
    }
    const missing = defsForCategory.filter((def) => {
      if (!def.required) return false;
      const value = values.attributes[def.key];
      return value === undefined || value === null || value === "";
    });
    if (missing.length > 0) {
      toast.error(`Fill the required field${missing.length > 1 ? "s" : ""}: ${missing.map((d) => d.label).join(", ")}`);
      return;
    }

    setSaving(true);
    const result = product
      ? await updateProduct(product.id, raw)
      : await createProduct(raw);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? "Product updated." : "Product created.");
    onOpenChange(false);
    onSaved();
  }

  async function handleCreateCategory(name: string): Promise<string | null> {
    const result = await createCategory({ name, kind: "other" });
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    onCategoryCreated({ ...result.data, kind: "other", isSystem: false });
    toast.success(`Category "${result.data.name}" created.`);
    return result.data.id;
  }

  async function handleCreateUnit(name: string): Promise<string | null> {
    const result = await createUnit({ code: name, label: name, dimension: "count" });
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    onUnitCreated({ ...result.data, dimension: "count" });
    toast.success(`Unit "${result.data.code}" created.`);
    return result.data.id;
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{product ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription>
            {product ? `Editing ${product.name}` : "Add something the farm makes, keeps or buys."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-5 p-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pf-name">Name</Label>
              <Input id="pf-name" {...form.register("name")} />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-sku">SKU</Label>
              <Input id="pf-sku" placeholder="optional" {...form.register("sku")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <CreatableCombobox
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId || undefined}
                onChange={(value) => {
                  form.setValue("categoryId", value, { shouldValidate: false });
                  form.clearErrors("categoryId");
                }}
                onCreate={handleCreateCategory}
                placeholder="Pick or create…"
                createLabel={(q) => `Create category "${q}"`}
              />
              {errors.categoryId ? (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Unit</Label>
              <CreatableCombobox
                options={units.map((u) => ({ value: u.id, label: u.code, hint: u.label }))}
                value={form.watch("unitId") || undefined}
                onChange={(value) => {
                  form.setValue("unitId", value);
                  form.clearErrors("unitId");
                }}
                onCreate={handleCreateUnit}
                placeholder="Pick or create…"
                createLabel={(q) => `Create unit "${q}"`}
              />
              {errors.unitId ? (
                <p className="text-sm text-destructive">{errors.unitId.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-species">Species</Label>
              <Input id="pf-species" placeholder="optional" {...form.register("species")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-breed">Breed</Label>
              <Input id="pf-breed" placeholder="optional" {...form.register("breed")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-price">Unit price</Label>
              <Input id="pf-price" inputMode="decimal" {...form.register("unitPrice")} />
              {errors.unitPrice ? (
                <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-cost">Cost price</Label>
              <Input id="pf-cost" inputMode="decimal" {...form.register("costPrice")} />
              {errors.costPrice ? (
                <p className="text-sm text-destructive">{errors.costPrice.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-stock">Stock quantity</Label>
              <Input id="pf-stock" inputMode="decimal" {...form.register("stockQty")} />
              {errors.stockQty ? (
                <p className="text-sm text-destructive">{errors.stockQty.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-reorder">Reorder level</Label>
              <Input
                id="pf-reorder"
                inputMode="decimal"
                placeholder="optional"
                {...form.register("reorderLevel")}
              />
            </div>
          </div>

          {/* Live calculation strip (SPEC §8) */}
          <div className="kpi grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className="font-mono">{calc.margin ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margin %</p>
              <p className="font-mono">{calc.marginPct ? `${calc.marginPct}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Markup %</p>
              <p className="font-mono">{calc.markupPct ? `${calc.markupPct}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock value</p>
              <p className="font-mono">{calc.stockValue ?? "—"}</p>
            </div>
          </div>

          {categoryId ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Custom fields</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddFieldOpen(true)}
                >
                  <Plus className="size-4" /> Add custom field
                </Button>
              </div>
              {defsForCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom fields for this category yet — add one, it sticks for
                  every product in the category.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {defsForCategory.map((def) => (
                    <AttributeField
                      key={def.id}
                      def={def}
                      value={attributes[def.key]}
                      onChange={(value) =>
                        form.setValue("attributes", { ...attributes, [def.key]: value })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <Separator />

          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-tags">Tags</Label>
              <Input id="pf-tags" placeholder="comma, separated" {...form.register("tagsText")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pf-notes">Notes</Label>
              <Textarea id="pf-notes" rows={2} {...form.register("notes")} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="pf-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Archived products stay in history but leave the pickers.
                </p>
              </div>
              <Switch
                id="pf-active"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
              />
            </div>
          </div>

          <SheetFooter className="mt-auto flex-row justify-end gap-2 px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {product ? "Save changes" : "Create product"}
            </Button>
          </SheetFooter>
        </form>

        <AddFieldDialog
          open={addFieldOpen}
          onOpenChange={setAddFieldOpen}
          categoryId={categoryId}
          onCreated={onAttributeDefCreated}
        />
      </SheetContent>
    </Sheet>
  );
}

function AttributeField({
  def,
  value,
  onChange,
}: {
  def: AttributeDefRow;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `attr-${def.key}`;
  const label = (
    <Label htmlFor={id}>
      {def.label}
      {def.required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  switch (def.type) {
    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-lg border p-3">
          {label}
          <Switch id={id} checked={value === true} onCheckedChange={onChange} />
        </div>
      );
    case "select":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Select
            value={typeof value === "string" ? value : undefined}
            onValueChange={onChange}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {(def.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "number":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            inputMode="decimal"
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
    case "date":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
    default:
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
  }
}

function AddFieldDialog({
  open,
  onOpenChange,
  categoryId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  onCreated: (def: AttributeDefRow) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AttributeDefRow["type"]>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await createAttributeDef({
      categoryId,
      label,
      type,
      options: optionsText.split(",").map((o) => o.trim()).filter(Boolean),
      required,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onCreated(result.data);
    toast.success(`Field "${result.data.label}" added to this category.`);
    setLabel("");
    setType("text");
    setOptionsText("");
    setRequired(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add custom field</DialogTitle>
          <DialogDescription>
            e.g. “Ear tag”, “Vaccination date”, “Milk fat %”, “Hive queen year”.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="af-label">Label</Label>
            <Input id="af-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AttributeDefRow["type"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="select">Select (options)</SelectItem>
                <SelectItem value="boolean">Yes / no</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "select" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="af-options">Options</Label>
              <Input
                id="af-options"
                placeholder="comma, separated, options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="af-required">Required</Label>
            <Switch id="af-required" checked={required} onCheckedChange={setRequired} />
          </div>
          <Button onClick={() => void submit()} disabled={saving || label.trim().length === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Add field
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
