"use client";

import { CircleCheck, FileSpreadsheet, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MappingReview } from "@/components/import/mapping-review";
import { UploadDropzone } from "@/components/import/upload-dropzone";
import { normalizeRows } from "@/lib/import/normalize";
import { computeQuality } from "@/lib/import/quality";
import { headerSignature } from "@/lib/import/signature";
import type {
  ImportMapping,
  InferredSchema,
  ParsedSheet,
  SemanticRole,
} from "@/lib/import/types";
import type { ParseWorkerResponse } from "@/lib/import/parse.worker";
import type { CategoryOption } from "@/lib/products/queries";

type Step = "upload" | "sheet" | "review" | "match" | "commit" | "done";

interface MatchState {
  name: string;
  suggestionId: string | null;
  suggestionName: string | null;
  score: number;
  action: "map" | "create" | "skip";
  categoryId: string | null;
}

interface CommitResult {
  transactions: number;
  createdProducts: number;
  createdParties: number;
  skippedNoProduct: number;
  skippedByChoice: number;
}

const CHUNK_SIZE = 1000;

function defaultMapping(schema: InferredSchema): ImportMapping {
  // Only one column per exclusive role — extra claimants fall back.
  const exclusive: SemanticRole[] = [
    "period", "entity_name", "quantity", "unit", "unit_price", "total_amount", "party", "transaction_type", "notes",
  ];
  const taken = new Set<SemanticRole>();
  return {
    columns: schema.columns.map((column) => {
      let role = column.role;
      if (exclusive.includes(role)) {
        if (taken.has(role)) {
          role = column.physicalType === "date" ? "dimension" : "measure";
        } else {
          taken.add(role);
        }
      }
      return {
        index: column.index,
        header: column.header,
        include: column.physicalType !== "empty",
        type: column.physicalType,
        role,
        unitCode: null,
        dateOrder: "DMY" as const,
      };
    }),
    currency: schema.crossChecks.detectedCurrency ?? "USD",
    authoritativeAmount: "total",
    defaultTransactionType: "sale",
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export function ImportWizard({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const bufferRef = useRef<ArrayBuffer | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [schema, setSchema] = useState<InferredSchema | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [signature, setSignature] = useState("");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchState[]>([]);
  const [progress, setProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [importId, setImportId] = useState<string | null>(null);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  // Full normalization + quality, recomputed as the mapping changes.
  const normalized = useMemo(
    () => (sheet && mapping ? normalizeRows(sheet, mapping) : []),
    [sheet, mapping],
  );
  const quality = useMemo(
    () => (sheet && mapping ? computeQuality(sheet, mapping, normalized) : null),
    [sheet, mapping, normalized],
  );

  function parseInWorker(buffer: ArrayBuffer, sheetName: string | null) {
    setBusy(true);
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../../lib/import/parse.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = async (event: MessageEvent<ParseWorkerResponse>) => {
      setBusy(false);
      const data = event.data;
      if (!data.ok) {
        toast.error(data.error);
        setStep("upload");
        return;
      }
      setSheetNames(data.sheetNames);
      if (sheetName === null && data.sheetNames.length > 1) {
        setStep("sheet");
        return;
      }
      setSheet(data.sheet);
      setSchema(data.schema);
      const sig = await headerSignature(data.sheet.columns.map((column) => column.header));
      setSignature(sig);

      // Auto-apply a saved profile for this file shape (SPEC §5.3).
      let applied: ImportMapping | null = null;
      try {
        const response = await fetch(`/api/import-profiles?signature=${sig}`);
        if (response.ok) {
          const { profile } = (await response.json()) as {
            profile: { name: string; mapping: ImportMapping } | null;
          };
          if (profile) {
            applied = profile.mapping;
            setProfileName(profile.name);
          }
        }
      } catch {
        // Profile lookup is best-effort; inference still stands.
      }
      if (!applied) setProfileName(null);
      setMapping(applied ?? defaultMapping(data.schema));
      setStep("review");
    };
    worker.onerror = () => {
      setBusy(false);
      toast.error("Could not read the file.");
      setStep("upload");
    };
    worker.postMessage({ buffer, sheetName }, [buffer]);
  }

  async function handleFile(file: File) {
    setFilename(file.name);
    const buffer = await file.arrayBuffer();
    // Keep a copy — the original is transferred to the worker.
    bufferRef.current = buffer.slice(0);
    parseInWorker(buffer, null);
  }

  function pickSheet(name: string) {
    if (!bufferRef.current) return;
    const buffer = bufferRef.current.slice(0);
    parseInWorker(buffer, name);
  }

  async function continueToMatch() {
    if (!mapping) return;
    setBusy(true);
    try {
      const names = [
        ...new Set(
          normalized
            .map((row) => row.productName)
            .filter((name): name is string => name !== null),
        ),
      ].slice(0, 2000);
      if (names.length === 0) {
        setMatches([]);
        setStep("match");
        return;
      }
      const { matches: found } = await postJson<{
        matches: { name: string; productId: string | null; productName: string | null; score: number }[];
      }>("/api/imports/match-products", { names });
      setMatches(
        found.map((match) => ({
          name: match.name,
          suggestionId: match.productId,
          suggestionName: match.productName,
          score: match.score,
          action: match.productId ? "map" : "create",
          categoryId: null,
        })),
      );
      setStep("match");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Matching failed.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!sheet || !mapping || !schema) return;
    setStep("commit");
    setBusy(true);
    setProgress(0);
    try {
      const { id } = await postJson<{ id: string }>("/api/imports", {
        filename,
        sheetName: sheet.name,
        signature,
        rowCount: normalized.length,
        mapping,
        inferredSchema: schema,
        quality,
      });
      setImportId(id);

      // Chunked upload: raw + normalized per row, idempotent per chunk.
      const byIndex = new Map(sheet.columns.map((column) => [column.index, column]));
      const payloadRows = normalized.map((row) => {
        const raw: Record<string, unknown> = {};
        for (const column of mapping.columns) {
          const cell = byIndex.get(column.index)?.cells[row.rowIndex];
          raw[column.header] =
            cell?.v instanceof Date ? cell.v.toISOString().slice(0, 10) : (cell?.v ?? null);
        }
        return { rowIndex: row.rowIndex, raw, normalized: row };
      });
      for (let i = 0; i < payloadRows.length; i += CHUNK_SIZE) {
        await postJson(`/api/imports/${id}/rows`, {
          chunkIndex: Math.floor(i / CHUNK_SIZE),
          rows: payloadRows.slice(i, i + CHUNK_SIZE),
        });
        setProgress(Math.min(95, Math.round(((i + CHUNK_SIZE) / payloadRows.length) * 90)));
      }

      const result = await postJson<CommitResult>(`/api/imports/${id}/commit`, {
        matches: matches.map((match) => ({
          name: match.name,
          action: match.action,
          productId: match.action === "map" ? match.suggestionId : null,
          categoryId: match.categoryId,
        })),
      });
      setProgress(100);
      setCommitResult(result);
      setStep("done");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
      setStep("match");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!mapping) return;
    const name = window.prompt("Name this mapping profile:", filename.replace(/\.[^.]+$/, ""));
    if (!name?.trim()) return;
    try {
      await postJson("/api/import-profiles", { signature, name: name.trim(), mapping });
      toast.success(`Profile "${name.trim()}" saved — same-shaped files will auto-apply it.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the profile.");
    }
  }

  function reset() {
    setStep("upload");
    setSheet(null);
    setSchema(null);
    setMapping(null);
    setMatches([]);
    setProfileName(null);
    setCommitResult(null);
    setImportId(null);
    bufferRef.current = null;
  }

  if (step === "upload") {
    return <UploadDropzone busy={busy} onFile={(file) => void handleFile(file)} />;
  }

  if (step === "sheet") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pick a sheet</CardTitle>
          <CardDescription>“{filename}” has {sheetNames.length} sheets.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sheetNames.map((name) => (
            <Button key={name} variant="outline" onClick={() => pickSheet(name)} disabled={busy}>
              <FileSpreadsheet className="size-4" /> {name}
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (step === "review" && sheet && schema && mapping) {
    return (
      <MappingReview
        sheet={sheet}
        schema={schema}
        mapping={mapping}
        onMappingChange={setMapping}
        quality={quality}
        profileName={profileName}
        onSaveProfile={() => void saveProfile()}
        onBack={reset}
        onContinue={() => void continueToMatch()}
        busy={busy}
      />
    );
  }

  if (step === "match") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Match products</CardTitle>
          <CardDescription>
            {matches.length === 0
              ? "No product names were found — rows will be skipped unless a name column is mapped."
              : "Confirm how imported names map to your catalogue. Nothing is saved until you import."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {matches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>In the file</TableHead>
                  <TableHead>Suggested match</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category (for new)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match, index) => (
                  <TableRow key={match.name}>
                    <TableCell className="max-w-44 truncate font-medium">{match.name}</TableCell>
                    <TableCell>
                      {match.suggestionName ? (
                        <span className="flex items-center gap-2">
                          <span className="max-w-40 truncate">{match.suggestionName}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {Math.round(match.score * 100)}%
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">no match</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={match.action}
                        onValueChange={(value) =>
                          setMatches((current) =>
                            current.map((m, i) =>
                              i === index ? { ...m, action: value as MatchState["action"] } : m,
                            ),
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="map" disabled={!match.suggestionId}>
                            Use the match
                          </SelectItem>
                          <SelectItem value="create">Create new product</SelectItem>
                          <SelectItem value="skip">Skip these rows</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {match.action === "create" ? (
                        <Select
                          value={match.categoryId ?? undefined}
                          onValueChange={(value) =>
                            setMatches((current) =>
                              current.map((m, i) => (i === index ? { ...m, categoryId: value } : m)),
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="w-40">
                            <SelectValue placeholder="Other" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep("review")} disabled={busy}>
              Back to mapping
            </Button>
            <Button onClick={() => void commit()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Import {normalized.length} rows
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "commit") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="font-medium">Importing {normalized.length} rows…</p>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">Chunked upload — safe to retry if interrupted.</p>
        </CardContent>
      </Card>
    );
  }

  if (step === "done" && commitResult) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-chart-1/15">
            <CircleCheck className="size-6" />
          </span>
          <div>
            <p className="font-heading text-xl font-semibold">
              Imported {commitResult.transactions} transactions
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {commitResult.createdProducts} new products · {commitResult.createdParties} new
              parties
              {commitResult.skippedNoProduct + commitResult.skippedByChoice > 0
                ? ` · ${commitResult.skippedNoProduct + commitResult.skippedByChoice} rows skipped`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {importId ? (
              <Button asChild>
                <Link href={`/data/${importId}`}>Open the dashboard</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/transactions">View transactions</Link>
            </Button>
            <Button variant="ghost" onClick={reset}>
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
