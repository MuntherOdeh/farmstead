import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, parties, products, transactions, units } from "@/db/schema";
import type { LedgerRow, ProductSnapshot } from "./calc";

export interface LedgerRowWithId extends LedgerRow {
  id: string;
  source: string;
  notes: string | null;
  currency: string;
}

export async function loadLedger(): Promise<LedgerRowWithId[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      occurredOn: transactions.occurredOn,
      productId: transactions.productId,
      productName: products.name,
      categorySlug: categories.slug,
      categoryName: categories.name,
      species: products.species,
      unitCode: units.code,
      qty: transactions.qty,
      unitPrice: transactions.unitPrice,
      total: transactions.total,
      costPrice: products.costPrice,
      partyId: transactions.partyId,
      partyName: parties.name,
      source: transactions.source,
      notes: transactions.notes,
      currency: transactions.currency,
    })
    .from(transactions)
    .innerJoin(products, eq(transactions.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(units, eq(transactions.unitId, units.id))
    .leftJoin(parties, eq(transactions.partyId, parties.id))
    .where(isNull(transactions.deletedAt));
  return rows;
}

export async function loadProductSnapshots(): Promise<ProductSnapshot[]> {
  const db = await getDb();
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      categorySlug: categories.slug,
      categoryName: categories.name,
      species: products.species,
      unitCode: units.code,
      stockQty: products.stockQty,
      costPrice: products.costPrice,
      unitPrice: products.unitPrice,
      reorderLevel: products.reorderLevel,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(units, eq(products.unitId, units.id))
    .where(isNull(products.deletedAt));
}
