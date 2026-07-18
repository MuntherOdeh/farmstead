import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { ArrowRight, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { imports, transactions } from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Datasets" };

export default async function DatasetsPage() {
  await requireUser();
  const db = await getDb();

  const rows = await db
    .select({
      id: imports.id,
      filename: imports.filename,
      sheetName: imports.sheetName,
      status: imports.status,
      rowCount: imports.rowCount,
      createdAt: imports.createdAt,
      mapping: imports.mapping,
    })
    .from(imports)
    .where(eq(imports.status, "committed"))
    .orderBy(desc(imports.createdAt));

  // How many ledger transactions each dataset produced.
  const txCounts = await db
    .select({ importId: transactions.importId })
    .from(transactions);
  const byImport = new Map<string, number>();
  for (const row of txCounts) {
    if (row.importId) byImport.set(row.importId, (byImport.get(row.importId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Datasets</h1>
        <p className="text-sm text-muted-foreground">
          Every sheet you&apos;ve imported, each with its own dashboard — open any one directly.
        </p>
      </div>

      {rows.length === 0 ? (
        <Empty className="min-h-[50vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSpreadsheet />
            </EmptyMedia>
            <EmptyTitle>No datasets yet</EmptyTitle>
            <EmptyDescription>
              Import a spreadsheet and each of its sheets becomes a dataset here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/import">Import a spreadsheet</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const mapping = (row.mapping ?? {}) as { referenceOnly?: boolean };
            const txns = byImport.get(row.id) ?? 0;
            return (
              <Link key={row.id} href={`/data/${row.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-ring/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <FileSpreadsheet className="size-4" />
                        </span>
                        <CardTitle className="truncate text-base" dir="auto">
                          {row.sheetName ?? row.filename}
                        </CardTitle>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <CardDescription className="truncate">{row.filename}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {row.rowCount} rows
                    </Badge>
                    {mapping.referenceOnly ? (
                      <Badge variant="secondary">reference</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-mono">
                        {txns} in ledger
                      </Badge>
                    )}
                    <span className="ms-auto text-xs text-muted-foreground">
                      {format(row.createdAt, "d MMM yy")}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
