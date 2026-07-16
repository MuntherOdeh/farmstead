"use server";

import Decimal from "decimal.js";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLog, transactions } from "@/db/schema";
import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-user";
import { decimalString, optionalDecimalString } from "@/lib/products/schemas";

const updateSchema = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd"),
  qty: decimalString({ allowNegative: false }),
  unitPrice: optionalDecimalString(),
  total: optionalDecimalString(),
  notes: z
    .union([z.literal(""), z.string().trim().max(1000)])
    .optional()
    .transform((value) => (value ? value : null)),
});

export type TransactionUpdate = z.input<typeof updateSchema>;

type Result = { ok: true } | { ok: false; error: string };

function failed(error: unknown): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  console.error("[transactions]", error);
  return { ok: false, error: "Something went wrong. Nothing was saved." };
}

const money = (value: string | null) =>
  value === null ? null : new Decimal(value).toDecimalPlaces(4).toFixed(4);

export async function updateTransaction(id: string, raw: unknown): Promise<Result> {
  try {
    const user = await requireAdmin();
    const input = updateSchema.parse(raw);
    const db = await getDb();
    const [before] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!before) return { ok: false, error: "Transaction not found." };

    let total = money(input.total);
    if (total === null && input.unitPrice !== null) {
      total = new Decimal(input.qty).mul(input.unitPrice).toDecimalPlaces(2).toFixed(4);
    }
    await db
      .update(transactions)
      .set({
        occurredOn: input.occurredOn,
        qty: new Decimal(input.qty).toFixed(4),
        unitPrice: money(input.unitPrice),
        total,
        notes: input.notes,
      })
      .where(eq(transactions.id, id));
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "transaction",
      entityId: id,
      action: "update",
      before: {
        occurredOn: before.occurredOn,
        qty: before.qty,
        unitPrice: before.unitPrice,
        total: before.total,
      },
      after: input,
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function softDeleteTransaction(id: string): Promise<Result> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    await db.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, id));
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "transaction",
      entityId: id,
      action: "delete",
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function restoreTransaction(id: string): Promise<Result> {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    await db.update(transactions).set({ deletedAt: null }).where(eq(transactions.id, id));
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "transaction",
      entityId: id,
      action: "restore",
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}
