"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dashboards } from "@/db/schema";
import { requireUserApi, UnauthorizedError } from "@/lib/auth/require-user";

const layoutSchema = z.object({
  datasetRef: z.string().min(1),
  layout: z.object({
    order: z.array(z.string()),
    hidden: z.array(z.string()),
    pinned: z.array(z.string()),
    kinds: z.record(z.string(), z.string()),
  }),
});

export type DashboardLayout = z.infer<typeof layoutSchema>["layout"];

/** Persist widget layout per dataset per user (SPEC §5.5). */
export async function saveDashboardLayout(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUserApi();
    const { datasetRef, layout } = layoutSchema.parse(raw);
    const db = await getDb();
    const [existing] = await db
      .select({ id: dashboards.id })
      .from(dashboards)
      .where(and(eq(dashboards.datasetRef, datasetRef), eq(dashboards.ownerId, user.id)));
    if (existing) {
      await db.update(dashboards).set({ layout }).where(eq(dashboards.id, existing.id));
    } else {
      await db.insert(dashboards).values({
        name: datasetRef,
        datasetRef,
        layout,
        ownerId: user.id,
      });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, error: "Not allowed." };
    }
    console.error("[dashboard]", error);
    return { ok: false, error: "Could not save the layout." };
  }
}
