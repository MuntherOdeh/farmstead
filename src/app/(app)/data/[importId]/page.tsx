import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { dashboards, importRows, imports } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import type { DashboardLayout } from "@/lib/dashboard/actions";
import { parseFinancialSummary } from "@/lib/import/financial-summary";
import type { ImportMapping } from "@/lib/import/types";
import { DataDashboard } from "@/components/data/data-dashboard";
import { FinancialSummaryView } from "@/components/data/financial-summary-view";

export const metadata: Metadata = { title: "Dataset" };

export default async function DataPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const user = await requireUser();
  const { importId } = await params;
  const db = await getDb();

  const [batch] = await db.select().from(imports).where(eq(imports.id, importId));
  if (!batch) notFound();

  const [saved] = await db
    .select({ layout: dashboards.layout })
    .from(dashboards)
    .where(and(eq(dashboards.datasetRef, importId), eq(dashboards.ownerId, user.id)));

  // Structure-aware rendering: Arabic financial-summary sheets get their own
  // dedicated view instead of the generic widget engine.
  const rawSample = await db
    .select({ raw: importRows.raw })
    .from(importRows)
    .where(eq(importRows.importId, importId))
    .orderBy(asc(importRows.rowIndex))
    .limit(400);
  const financialSummary = parseFinancialSummary(
    rawSample.map((row) => row.raw as Record<string, unknown>),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link href="/import">
            <ArrowLeft className="size-4" /> All imports
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {batch.filename}
          </h1>
          <Badge variant="secondary" className="capitalize">
            {batch.status.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {batch.rowCount} rows
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {financialSummary
            ? "Recognised as a financial summary sheet — rendered in its own layout, exactly as recorded."
            : "A dashboard generated from the file's own columns — pin, hide, drag or retype any chart; the table below is the ground truth."}
        </p>
      </div>

      {financialSummary ? (
        <FinancialSummaryView summary={financialSummary} />
      ) : batch.status === "committed" || batch.status === "rolled_back" ? (
        <DataDashboard
          importId={importId}
          filename={batch.filename}
          mapping={batch.mapping as ImportMapping}
          rowCount={batch.rowCount}
          initialLayout={(saved?.layout as DashboardLayout | undefined) ?? null}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This import hasn&apos;t been committed yet — finish it from the Import
          page first.
        </p>
      )}
    </div>
  );
}
