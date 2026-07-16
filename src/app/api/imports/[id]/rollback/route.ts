import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, imports, parties, products, transactions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-user";
import { handleRoute, jsonError } from "@/lib/import/api-helpers";

type Params = { params: Promise<{ id: string }> };

/**
 * One-click rollback (SPEC §5.4): delete the import's transactions and
 * everything the commit created (products/parties), then mark the batch.
 */
export async function POST(_request: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const user = await requireAdmin();
    const { id } = await params;
    const db = await getDb();

    const [batch] = await db.select().from(imports).where(eq(imports.id, id));
    if (!batch) return jsonError(404, "Import not found");
    if (batch.status !== "committed") {
      return jsonError(409, `Only committed imports can be rolled back (status: ${batch.status})`);
    }

    const mapping = (batch.mapping ?? {}) as {
      createdProductIds?: string[];
      createdPartyIds?: string[];
    };

    const deleted = await db
      .delete(transactions)
      .where(eq(transactions.importId, id))
      .returning({ id: transactions.id });

    if (mapping.createdProductIds && mapping.createdProductIds.length > 0) {
      await db
        .update(products)
        .set({ deletedAt: new Date() })
        .where(inArray(products.id, mapping.createdProductIds));
    }
    if (mapping.createdPartyIds && mapping.createdPartyIds.length > 0) {
      await db
        .update(parties)
        .set({ deletedAt: new Date() })
        .where(inArray(parties.id, mapping.createdPartyIds));
    }

    await db.update(imports).set({ status: "rolled_back" }).where(eq(imports.id, id));
    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "import",
      entityId: id,
      action: "rollback",
      after: {
        transactionsRemoved: deleted.length,
        productsArchived: mapping.createdProductIds?.length ?? 0,
        partiesArchived: mapping.createdPartyIds?.length ?? 0,
      },
    });

    return Response.json({
      transactionsRemoved: deleted.length,
      productsArchived: mapping.createdProductIds?.length ?? 0,
      partiesArchived: mapping.createdPartyIds?.length ?? 0,
    });
  });
}
