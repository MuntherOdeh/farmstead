import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attributeDefs,
  auditLog,
  categories,
  parties,
  products,
  transactions,
  units,
} from "@/db/schema";

export interface ProductRow {
  id: string;
  sku: string | null;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  unitId: string;
  unitCode: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  unitPrice: string | null;
  costPrice: string | null;
  currency: string;
  stockQty: string;
  reorderLevel: string | null;
  attributes: Record<string, unknown>;
  tags: string[] | null;
  notes: string | null;
  isActive: boolean;
  updatedAt: Date;
}

export async function listProducts(): Promise<ProductRow[]> {
  const db = await getDb();
  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      unitId: products.unitId,
      unitCode: units.code,
      species: products.species,
      breed: products.breed,
      description: products.description,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      currency: products.currency,
      stockQty: products.stockQty,
      reorderLevel: products.reorderLevel,
      attributes: products.attributes,
      tags: products.tags,
      notes: products.notes,
      isActive: products.isActive,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(units, eq(products.unitId, units.id))
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.name));
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  kind: string;
  isSystem: boolean;
}

export async function listCategories(): Promise<CategoryOption[]> {
  const db = await getDb();
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      kind: categories.kind,
      isSystem: categories.isSystem,
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.name));
}

export interface UnitOption {
  id: string;
  code: string;
  label: string;
  dimension: string;
}

export async function listUnits(): Promise<UnitOption[]> {
  const db = await getDb();
  return db
    .select({
      id: units.id,
      code: units.code,
      label: units.label,
      dimension: units.dimension,
    })
    .from(units)
    .orderBy(asc(units.code));
}

export interface AttributeDefRow {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options: string[] | null;
  required: boolean;
  sortOrder: number;
}

export async function listAttributeDefs(): Promise<AttributeDefRow[]> {
  const db = await getDb();
  return db
    .select({
      id: attributeDefs.id,
      categoryId: attributeDefs.categoryId,
      key: attributeDefs.key,
      label: attributeDefs.label,
      type: attributeDefs.type,
      options: attributeDefs.options,
      required: attributeDefs.required,
      sortOrder: attributeDefs.sortOrder,
    })
    .from(attributeDefs)
    .orderBy(asc(attributeDefs.sortOrder));
}

export interface ProductTransactionRow {
  id: string;
  type: string;
  occurredOn: string;
  qty: string;
  unitPrice: string | null;
  total: string | null;
  currency: string;
  partyName: string | null;
  notes: string | null;
}

export interface AuditRow {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  at: Date;
}

export async function getProductDetail(id: string) {
  const db = await getDb();
  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      unitId: products.unitId,
      unitCode: units.code,
      species: products.species,
      breed: products.breed,
      description: products.description,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      currency: products.currency,
      stockQty: products.stockQty,
      reorderLevel: products.reorderLevel,
      attributes: products.attributes,
      tags: products.tags,
      notes: products.notes,
      isActive: products.isActive,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(units, eq(products.unitId, units.id))
    .where(and(eq(products.id, id), isNull(products.deletedAt)));

  if (!product) return null;

  const txns: ProductTransactionRow[] = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      occurredOn: transactions.occurredOn,
      qty: transactions.qty,
      unitPrice: transactions.unitPrice,
      total: transactions.total,
      currency: transactions.currency,
      partyName: parties.name,
      notes: transactions.notes,
    })
    .from(transactions)
    .leftJoin(parties, eq(transactions.partyId, parties.id))
    .where(and(eq(transactions.productId, id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredOn));

  const history: AuditRow[] = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      before: auditLog.before,
      after: auditLog.after,
      at: auditLog.at,
    })
    .from(auditLog)
    .where(and(eq(auditLog.entity, "product"), eq(auditLog.entityId, id)))
    .orderBy(desc(auditLog.at));

  return { product, transactions: txns, history };
}
