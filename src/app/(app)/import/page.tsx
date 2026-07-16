import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { imports } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { listCategories } from "@/lib/products/queries";
import { ImportHistory, type ImportHistoryRow } from "@/components/import/import-history";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const db = await getDb();
  const [historyRows, categories] = await Promise.all([
    db
      .select({
        id: imports.id,
        filename: imports.filename,
        sheetName: imports.sheetName,
        status: imports.status,
        rowCount: imports.rowCount,
        createdAt: imports.createdAt,
      })
      .from(imports)
      .orderBy(desc(imports.createdAt))
      .limit(50),
    listCategories(),
  ]);

  const history: ImportHistoryRow[] = historyRows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload any sales spreadsheet — Farmstead reads it, works out what the
          columns mean, and you confirm before anything is saved.
        </p>
      </div>

      {user.role === "admin" ? (
        <ImportWizard categories={categories} />
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Importing needs an admin account — viewers can browse the results.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">History</h2>
        <ImportHistory rows={history} canEdit={user.role === "admin"} />
      </section>
    </div>
  );
}
