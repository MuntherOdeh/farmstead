import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mappingProfiles } from "@/db/schema";
import { requireAdmin, requireUserApi } from "@/lib/auth/require-user";
import { handleRoute, jsonError } from "@/lib/import/api-helpers";
import { saveProfileSchema } from "@/lib/import/api-schemas";

/** Look up a saved mapping profile by file signature (SPEC §5.3). */
export async function GET(request: Request): Promise<Response> {
  return handleRoute(async () => {
    await requireUserApi();
    const signature = new URL(request.url).searchParams.get("signature");
    if (!signature) return jsonError(400, "signature is required");
    const db = await getDb();
    const [profile] = await db
      .select({
        id: mappingProfiles.id,
        name: mappingProfiles.name,
        mapping: mappingProfiles.mapping,
      })
      .from(mappingProfiles)
      .where(eq(mappingProfiles.signature, signature))
      .orderBy(desc(mappingProfiles.createdAt))
      .limit(1);
    return Response.json({ profile: profile ?? null });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const user = await requireAdmin();
    const body = saveProfileSchema.parse(await request.json());
    const db = await getDb();
    const [row] = await db
      .insert(mappingProfiles)
      .values({
        signature: body.signature,
        name: body.name,
        mapping: body.mapping,
        createdBy: user.id,
      })
      .returning({ id: mappingProfiles.id });
    return Response.json({ id: row.id });
  });
}
