import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { importRows, imports } from "@/db/schema";
import { requireAdmin, requireUserApi } from "@/lib/auth/require-user";
import { handleRoute, jsonError } from "@/lib/import/api-helpers";
import { chunkSchema } from "@/lib/import/api-schemas";

type Params = { params: Promise<{ id: string }> };

/**
 * Receive one ~2,000-row chunk. Idempotent: the (import_id, row_index) unique
 * index + ON CONFLICT DO NOTHING means a re-sent chunk never duplicates rows,
 * and a chunk is a single INSERT statement, so it lands atomically.
 */
export async function POST(request: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = chunkSchema.parse(await request.json());
    const db = await getDb();
    const [batch] = await db
      .select({ id: imports.id, status: imports.status })
      .from(imports)
      .where(eq(imports.id, id));
    if (!batch) return jsonError(404, "Import not found");
    if (batch.status !== "pending" && batch.status !== "mapping") {
      return jsonError(409, `Import is ${batch.status} — no more chunks accepted`);
    }
    await db
      .insert(importRows)
      .values(
        body.rows.map((row) => ({
          importId: id,
          rowIndex: row.rowIndex,
          raw: row.raw,
          normalized: row.normalized,
          errors: row.normalized.problems.length > 0 ? row.normalized.problems : null,
        })),
      )
      .onConflictDoNothing();
    return Response.json({ received: body.rows.length, chunkIndex: body.chunkIndex });
  });
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    await requireUserApi();
    const { id } = await params;
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? 500)));
    const db = await getDb();
    const rows = await db
      .select({
        rowIndex: importRows.rowIndex,
        raw: importRows.raw,
        normalized: importRows.normalized,
        errors: importRows.errors,
      })
      .from(importRows)
      .where(eq(importRows.importId, id))
      .orderBy(asc(importRows.rowIndex))
      .offset(offset)
      .limit(limit);
    return Response.json({ rows });
  });
}
