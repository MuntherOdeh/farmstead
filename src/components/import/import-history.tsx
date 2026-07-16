"use client";

import { format } from "date-fns";
import { Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ImportHistoryRow {
  id: string;
  filename: string;
  sheetName: string | null;
  status: string;
  rowCount: number;
  createdAt: string; // ISO
}

const STATUS_TONE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  committed: "default",
  pending: "secondary",
  mapping: "secondary",
  committing: "secondary",
  failed: "destructive",
  rolled_back: "outline",
};

export function ImportHistory({
  rows,
  canEdit,
}: {
  rows: ImportHistoryRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  async function rollback(row: ImportHistoryRow) {
    setRollingBack(row.id);
    try {
      const response = await fetch(`/api/imports/${row.id}/rollback`, { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        transactionsRemoved?: number;
      };
      if (!response.ok) throw new Error(data.error ?? "Rollback failed");
      toast.success(
        `Rolled back "${row.filename}" — ${data.transactionsRemoved} transactions removed.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rollback failed.");
    } finally {
      setRollingBack(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No imports yet — the history of every upload lands here, with one-click
        rollback.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead className="hidden sm:table-cell">Sheet</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-end">Rows</TableHead>
          <TableHead className="hidden md:table-cell">When</TableHead>
          <TableHead className="text-end">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-w-48 truncate font-medium">{row.filename}</TableCell>
            <TableCell className="hidden max-w-28 truncate text-muted-foreground sm:table-cell">
              {row.sheetName ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_TONE[row.status] ?? "secondary"} className="capitalize">
                {row.status.replace(/_/g, " ")}
              </Badge>
            </TableCell>
            <TableCell className="text-end font-mono text-xs">{row.rowCount}</TableCell>
            <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
              {format(new Date(row.createdAt), "d MMM yy, HH:mm")}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                {row.status === "committed" ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/data/${row.id}`}>Open</Link>
                  </Button>
                ) : null}
                {canEdit && row.status === "committed" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void rollback(row)}
                    disabled={rollingBack === row.id}
                  >
                    {rollingBack === row.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Undo2 className="size-4" />
                    )}
                    Rollback
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
