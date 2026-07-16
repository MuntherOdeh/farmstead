"use server";

import Decimal from "decimal.js";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { getDb, type Db } from "@/db";
import { attributeDefs, auditLog, categories, products, transactions, units } from "@/db/schema";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-user";
import {
  adjustStockSchema,
  attributeDefInputSchema,
  bulkArchiveSchema,
  bulkCategorySchema,
  bulkPriceSchema,
  categoryInputSchema,
  productInputSchema,
  slugify,
  unitInputSchema,
  type ProductInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function failed(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  console.error("[products]", error);
  return { ok: false, error: "Something went wrong. Nothing was saved." };
}

async function logAudit(
  db: Db,
  entry: {
    actorId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

const money = (value: string | null) =>
  value === null ? null : new Decimal(value).toDecimalPlaces(4).toFixed(4);

function productValues(input: ProductInput) {
  return {
    name: input.name,
    sku: input.sku,
    categoryId: input.categoryId,
    unitId: input.unitId,
    species: input.species,
    breed: input.breed,
    description: input.description,
    unitPrice: money(input.unitPrice),
    costPrice: money(input.costPrice),
    stockQty: new Decimal(input.stockQty).toFixed(4),
    reorderLevel: money(input.reorderLevel),
    attributes: input.attributes,
    tags: input.tags.length > 0 ? input.tags : null,
    notes: input.notes,
    isActive: input.isActive,
  };
}

export async function createProduct(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const input = productInputSchema.parse(raw);
    const db = await getDb();
    const [row] = await db
      .insert(products)
      .values(productValues(input))
      .returning({ id: products.id });
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: row.id,
      action: "create",
      after: input,
    });
    revalidatePath("/products");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return failed(error);
  }
}

export async function updateProduct(id: string, raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const input = productInputSchema.parse(raw);
    const db = await getDb();
    const [before] = await db.select().from(products).where(eq(products.id, id));
    if (!before) return { ok: false, error: "Product not found." };
    await db
      .update(products)
      .set({ ...productValues(input), updatedAt: new Date() })
      .where(eq(products.id, id));
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: id,
      action: "update",
      before: {
        name: before.name,
        unitPrice: before.unitPrice,
        costPrice: before.costPrice,
        stockQty: before.stockQty,
        categoryId: before.categoryId,
      },
      after: input,
    });
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error);
  }
}

export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const [source] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)));
    if (!source) return { ok: false, error: "Product not found." };
    const [row] = await db
      .insert(products)
      .values({
        name: `${source.name} (copy)`,
        sku: null,
        categoryId: source.categoryId,
        unitId: source.unitId,
        species: source.species,
        breed: source.breed,
        description: source.description,
        unitPrice: source.unitPrice,
        costPrice: source.costPrice,
        currency: source.currency,
        stockQty: "0.0000",
        reorderLevel: source.reorderLevel,
        attributes: source.attributes,
        tags: source.tags,
        notes: source.notes,
        isActive: source.isActive,
      })
      .returning({ id: products.id });
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: row.id,
      action: "duplicate",
      before: { sourceId: id },
    });
    revalidatePath("/products");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return failed(error);
  }
}

export async function softDeleteProduct(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: id,
      action: "delete",
    });
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error);
  }
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    await db.update(products).set({ deletedAt: null }).where(eq(products.id, id));
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: id,
      action: "restore",
    });
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error);
  }
}

export async function setArchived(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const { ids, archived } = bulkArchiveSchema.parse(raw);
    const db = await getDb();
    await db
      .update(products)
      .set({ isActive: !archived, updatedAt: new Date() })
      .where(inArray(products.id, ids));
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: ids.join(","),
      action: archived ? "archive" : "unarchive",
    });
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error);
  }
}

export async function adjustStock(raw: unknown): Promise<ActionResult<{ newQty: string }>> {
  try {
    const user = await requireAdmin();
    const input = adjustStockSchema.parse(raw);
    const db = await getDb();
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, input.productId), isNull(products.deletedAt)));
    if (!product) return { ok: false, error: "Product not found." };

    const delta = new Decimal(input.delta);
    const newQty = new Decimal(product.stockQty).plus(delta);
    if (newQty.isNegative()) {
      return { ok: false, error: "Stock can't go below zero." };
    }
    await db
      .update(products)
      .set({ stockQty: newQty.toFixed(4), updatedAt: new Date() })
      .where(eq(products.id, product.id));
    // The adjustment is a first-class ledger row, so history is queryable.
    await db.insert(transactions).values({
      type: "adjustment",
      occurredOn: format(new Date(), "yyyy-MM-dd"),
      productId: product.id,
      qty: delta.abs().toFixed(4),
      unitId: product.unitId,
      currency: product.currency,
      notes: `${delta.isNegative() ? "-" : "+"}${delta.abs().toString()} — ${input.reason}`,
      source: "manual",
    });
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: product.id,
      action: "adjust-stock",
      before: { stockQty: product.stockQty },
      after: { stockQty: newQty.toFixed(4), reason: input.reason },
    });
    revalidatePath("/products");
    revalidatePath(`/products/${product.id}`);
    return { ok: true, data: { newQty: newQty.toFixed(4) } };
  } catch (error) {
    return failed(error);
  }
}

export async function bulkPriceChange(raw: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await requireAdmin();
    const input = bulkPriceSchema.parse(raw);
    const db = await getDb();
    const rows = await db
      .select({ id: products.id, unitPrice: products.unitPrice, costPrice: products.costPrice })
      .from(products)
      .where(inArray(products.id, input.ids));

    const value = new Decimal(input.value);
    let updated = 0;
    for (const row of rows) {
      const current = input.field === "unitPrice" ? row.unitPrice : row.costPrice;
      if (current === null) continue;
      const base = new Decimal(current);
      const next =
        input.mode === "percent" ? base.mul(value.div(100).plus(1)) : base.plus(value);
      if (next.isNegative()) continue;
      await db
        .update(products)
        .set({
          [input.field]: next.toDecimalPlaces(4).toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(products.id, row.id));
      await logAudit(db, {
        actorId: user.id,
        entity: "product",
        entityId: row.id,
        action: "price-change",
        before: { [input.field]: current },
        after: { [input.field]: next.toDecimalPlaces(4).toFixed(4), mode: input.mode },
      });
      updated++;
    }
    revalidatePath("/products");
    return { ok: true, data: { updated } };
  } catch (error) {
    return failed(error);
  }
}

export async function bulkReassignCategory(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const input = bulkCategorySchema.parse(raw);
    const db = await getDb();
    await db
      .update(products)
      .set({ categoryId: input.categoryId, updatedAt: new Date() })
      .where(inArray(products.id, input.ids));
    await logAudit(db, {
      actorId: user.id,
      entity: "product",
      entityId: input.ids.join(","),
      action: "bulk-category",
      after: { categoryId: input.categoryId },
    });
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error);
  }
}

export async function createCategory(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string; slug: string }>> {
  try {
    const user = await requireAdmin();
    const input = categoryInputSchema.parse(raw);
    const db = await getDb();
    const slug = slugify(input.name);
    if (!slug) return { ok: false, error: "That name can't be turned into a slug." };
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug));
    if (existing.length > 0) return { ok: false, error: "A category with that name exists." };
    const [row] = await db
      .insert(categories)
      .values({ name: input.name, slug, kind: input.kind, isSystem: false, createdBy: user.id })
      .returning({ id: categories.id, name: categories.name, slug: categories.slug });
    revalidatePath("/products");
    return { ok: true, data: row };
  } catch (error) {
    return failed(error);
  }
}

export async function createUnit(
  raw: unknown,
): Promise<ActionResult<{ id: string; code: string; label: string }>> {
  try {
    await requireAdmin();
    const input = unitInputSchema.parse(raw);
    const db = await getDb();
    const existing = await db.select({ id: units.id }).from(units).where(eq(units.code, input.code));
    if (existing.length > 0) return { ok: false, error: "A unit with that code exists." };
    const [row] = await db
      .insert(units)
      .values({
        code: input.code,
        label: input.label,
        dimension: input.dimension,
        toBaseFactor: "1",
        isSystem: false,
      })
      .returning({ id: units.id, code: units.code, label: units.label });
    revalidatePath("/products");
    return { ok: true, data: row };
  } catch (error) {
    return failed(error);
  }
}

export async function createAttributeDef(raw: unknown): Promise<
  ActionResult<{
    id: string;
    categoryId: string;
    key: string;
    label: string;
    type: "text" | "number" | "date" | "select" | "boolean";
    options: string[] | null;
    required: boolean;
    sortOrder: number;
  }>
> {
  try {
    await requireAdmin();
    const input = attributeDefInputSchema.parse(raw);
    if (input.type === "select" && input.options.length === 0) {
      return { ok: false, error: "A select field needs at least one option." };
    }
    const db = await getDb();
    const key = slugify(input.label).replace(/-/g, "_");
    if (!key) return { ok: false, error: "That label can't be turned into a key." };
    const existing = await db
      .select({ id: attributeDefs.id })
      .from(attributeDefs)
      .where(and(eq(attributeDefs.categoryId, input.categoryId), eq(attributeDefs.key, key)));
    if (existing.length > 0) {
      return { ok: false, error: "This category already has a field with that name." };
    }
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${attributeDefs.sortOrder}), 0)::int` })
      .from(attributeDefs)
      .where(eq(attributeDefs.categoryId, input.categoryId));
    const [row] = await db
      .insert(attributeDefs)
      .values({
        categoryId: input.categoryId,
        key,
        label: input.label,
        type: input.type,
        options: input.type === "select" ? input.options : null,
        required: input.required,
        sortOrder: maxOrder + 1,
      })
      .returning();
    revalidatePath("/products");
    return {
      ok: true,
      data: {
        id: row.id,
        categoryId: row.categoryId,
        key: row.key,
        label: row.label,
        type: row.type,
        options: row.options,
        required: row.required,
        sortOrder: row.sortOrder,
      },
    };
  } catch (error) {
    return failed(error);
  }
}
