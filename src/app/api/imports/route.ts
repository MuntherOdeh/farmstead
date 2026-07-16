import { getDb } from "@/db";
import { imports } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-user";
import { handleRoute } from "@/lib/import/api-helpers";
import { createImportSchema } from "@/lib/import/api-schemas";

/** Create the import batch record; chunks and commit follow (SPEC §5.4). */
export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const user = await requireAdmin();
    const body = createImportSchema.parse(await request.json());
    const db = await getDb();
    const [row] = await db
      .insert(imports)
      .values({
        filename: body.filename,
        sheetName: body.sheetName,
        signature: body.signature,
        rowCount: body.rowCount,
        status: "pending",
        mapping: body.mapping,
        inferredSchema: body.inferredSchema,
        quality: body.quality,
        uploadedBy: user.id,
      })
      .returning({ id: imports.id });
    return Response.json({ id: row.id });
  });
}
