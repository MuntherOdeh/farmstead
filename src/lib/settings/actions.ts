"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import {
  attributeDefs,
  auditLog,
  categories,
  dashboards,
  importRows,
  imports,
  mappingProfiles,
  parties,
  products,
  transactions,
} from "@/db/schema";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-user";

/**
 * Wipe app data (never auth accounts) and regenerate the full §14 demo set.
 * Powers both "Load demo data" and "Reset demo" in /settings.
 */
/**
 * Wipe ALL farm data — demo or real — so the owner can start clean and build
 * the ledger from their own spreadsheets. Keeps: user accounts, settings, the
 * preset (system) categories and every unit, so the importer and product form
 * still have their building blocks. Custom categories go too.
 */
export async function clearAllData(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    // FK dependency order.
    await db.delete(transactions);
    await db.delete(importRows);
    await db.delete(imports);
    await db.delete(mappingProfiles);
    await db.delete(dashboards);
    await db.delete(products);
    await db.delete(attributeDefs);
    await db.delete(parties);
    await db.delete(categories).where(eq(categories.isSystem, false));
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "demo-data",
      entityId: "singleton",
      action: "clear-all",
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    console.error("[clear-all]", error);
    return { ok: false, error: "Clearing failed — nothing was changed." };
  }
}

export async function reseedDemoData(): Promise<
  { ok: true; transactions: number } | { ok: false; error: string }
> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const summary = await seedDatabase(db);
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "demo-data",
      entityId: "singleton",
      action: "reseed",
      after: { transactions: summary.transactions, products: summary.products },
    });
    revalidatePath("/", "layout");
    return { ok: true, transactions: summary.transactions };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    console.error("[demo-data]", error);
    return { ok: false, error: "Reseeding failed — nothing was changed." };
  }
}
