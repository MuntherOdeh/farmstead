"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  AdjustStockDialog,
  BulkCategoryDialog,
  BulkPriceDialog,
} from "@/components/products/product-dialogs";
import { ProductFormSheet } from "@/components/products/product-form-sheet";
import { ProductsTable } from "@/components/products/products-table";
import {
  duplicateProduct,
  restoreProduct,
  setArchived,
  softDeleteProduct,
} from "@/lib/products/actions";
import { exportProductsToXlsx } from "@/lib/products/export";
import type {
  AttributeDefRow,
  CategoryOption,
  ProductRow,
  UnitOption,
} from "@/lib/products/queries";

interface ProductsViewProps {
  initialProducts: ProductRow[];
  initialCategories: CategoryOption[];
  initialUnits: UnitOption[];
  initialAttributeDefs: AttributeDefRow[];
  canEdit: boolean;
}

export function ProductsView({
  initialProducts,
  initialCategories,
  initialUnits,
  initialAttributeDefs,
  canEdit,
}: ProductsViewProps) {
  const router = useRouter();
  // Local copies allow optimistic updates; a server refresh delivers new props
  // and state re-syncs during render (the React-sanctioned derive pattern).
  const [rows, setRows] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [units, setUnits] = useState(initialUnits);
  const [attributeDefs, setAttributeDefs] = useState(initialAttributeDefs);

  const [prevProducts, setPrevProducts] = useState(initialProducts);
  if (prevProducts !== initialProducts) {
    setPrevProducts(initialProducts);
    setRows(initialProducts);
  }
  const [prevCategories, setPrevCategories] = useState(initialCategories);
  if (prevCategories !== initialCategories) {
    setPrevCategories(initialCategories);
    setCategories(initialCategories);
  }
  const [prevUnits, setPrevUnits] = useState(initialUnits);
  if (prevUnits !== initialUnits) {
    setPrevUnits(initialUnits);
    setUnits(initialUnits);
  }
  const [prevDefs, setPrevDefs] = useState(initialAttributeDefs);
  if (prevDefs !== initialAttributeDefs) {
    setPrevDefs(initialAttributeDefs);
    setAttributeDefs(initialAttributeDefs);
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [adjusting, setAdjusting] = useState<ProductRow | null>(null);
  const [bulkPriceRows, setBulkPriceRows] = useState<ProductRow[] | null>(null);
  const [bulkCategoryRows, setBulkCategoryRows] = useState<ProductRow[] | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleNew = useCallback(() => {
    setEditing(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback((row: ProductRow) => {
    setEditing(row);
    setSheetOpen(true);
  }, []);

  const handleDuplicate = useCallback(
    async (row: ProductRow) => {
      const result = await duplicateProduct(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Duplicated "${row.name}".`);
      refresh();
    },
    [refresh],
  );

  const handleArchiveToggle = useCallback(
    async (targets: ProductRow[], archived: boolean) => {
      const ids = new Set(targets.map((row) => row.id));
      const previous = rows;
      // Optimistic flip; rollback + toast on failure (SPEC §8).
      setRows((current) =>
        current.map((row) => (ids.has(row.id) ? { ...row, isActive: !archived } : row)),
      );
      const result = await setArchived({ ids: [...ids], archived });
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
        return;
      }
      toast.success(
        `${targets.length === 1 ? `"${targets[0].name}"` : `${targets.length} products`} ${archived ? "archived" : "unarchived"}.`,
      );
      refresh();
    },
    [rows, refresh],
  );

  const handleDelete = useCallback(
    async (row: ProductRow) => {
      const previous = rows;
      setRows((current) => current.filter((r) => r.id !== row.id));
      const result = await softDeleteProduct(row.id);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
        return;
      }
      // 5 seconds to change your mind (SPEC §8).
      toast(`Deleted "${row.name}"`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            void restoreProduct(row.id).then((restored) => {
              if (restored.ok) {
                toast.success(`Restored "${row.name}".`);
                refresh();
              } else {
                toast.error(restored.error);
              }
            });
          },
        },
      });
      refresh();
    },
    [rows, refresh],
  );

  const handleAdjustDone = useCallback(
    (productId: string, newQty: string) => {
      setRows((current) =>
        current.map((row) => (row.id === productId ? { ...row, stockQty: newQty } : row)),
      );
      refresh();
    },
    [refresh],
  );

  const handleExport = useCallback((targets: ProductRow[]) => {
    if (targets.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    exportProductsToXlsx(targets);
    toast.success(`Exported ${targets.length} product${targets.length === 1 ? "" : "s"} to Excel.`);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          The catalogue — livestock, produce, inputs and equipment.
        </p>
      </div>

      <ProductsTable
        rows={rows}
        categories={categories}
        canEdit={canEdit}
        onNew={handleNew}
        onEdit={handleEdit}
        onDuplicate={(row) => void handleDuplicate(row)}
        onAdjust={setAdjusting}
        onArchiveToggle={(targets, archived) => void handleArchiveToggle(targets, archived)}
        onDelete={(row) => void handleDelete(row)}
        onBulkPrice={setBulkPriceRows}
        onBulkCategory={setBulkCategoryRows}
        onExport={handleExport}
      />

      <ProductFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        product={editing}
        categories={categories}
        units={units}
        attributeDefs={attributeDefs}
        onCategoryCreated={(category) => setCategories((c) => [...c, category])}
        onUnitCreated={(unit) => setUnits((u) => [...u, unit])}
        onAttributeDefCreated={(def) => setAttributeDefs((d) => [...d, def])}
        onSaved={refresh}
      />
      <AdjustStockDialog
        product={adjusting}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null);
        }}
        onDone={handleAdjustDone}
      />
      <BulkPriceDialog
        rows={bulkPriceRows}
        onOpenChange={(open) => {
          if (!open) setBulkPriceRows(null);
        }}
        onDone={refresh}
      />
      <BulkCategoryDialog
        rows={bulkCategoryRows}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setBulkCategoryRows(null);
        }}
        onDone={refresh}
      />
    </div>
  );
}
