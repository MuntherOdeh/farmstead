"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import { auditLog } from "@/db/schema";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-user";

/**
 * Wipe app data (never auth accounts) and regenerate the full §14 demo set.
 * Powers both "Load demo data" and "Reset demo" in /settings.
 */
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
