"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { normalizeRows } from "@/lib/import/normalize";
import type {
  ImportMapping,
  InferredSchema,
  ParsedSheet,
  PhysicalType,
  QualityReport,
  SemanticRole,
} from "@/lib/import/types";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: PhysicalType[] = [
  "text", "integer", "decimal", "currency", "percent", "date", "boolean", "category", "id", "duration", "empty",
];

const ROLE_OPTIONS: { value: SemanticRole; label: string }[] = [
  { value: "period", label: "Date / period" },
  { value: "entity_name", label: "Product name" },
  { value: "entity_type", label: "Product type" },
  { value: "quantity", label: "Quantity" },
  { value: "unit", label: "Unit" },
  { value: "unit_price", label: "Unit price" },
  { value: "total_amount", label: "Total amount" },
  { value: "cost", label: "Cost" },
  { value: "party", label: "Customer / supplier" },
  { value: "location", label: "Location" },
  { value: "transaction_type", label: "Transaction type" },
  { value: "weight", label: "Weight" },
  { value: "breed", label: "Breed" },
  { value: "sex", label: "Sex" },
  { value: "age", label: "Age" },
  { value: "tag_id", label: "Tag / ID" },
  { value: "notes", label: "Notes" },
  { value: "dimension", label: "Other (category)" },
  { value: "measure", label: "Other (number)" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "JOD", "EGP"];

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.75
      ? "border-transparent bg-chart-1/15 text-foreground"
      : value >= 0.5
        ? "border-transparent bg-chart-2/20 text-foreground"
        : "border-transparent bg-destructive/10 text-destructive";
  return <Badge className={cn("font-mono text-xs", tone)}>{pct}%</Badge>;
}

interface MappingReviewProps {
  sheet: ParsedSheet;
  schema: InferredSchema;
  mapping: ImportMapping;
  onMappingChange: (mapping: ImportMapping) => void;
  quality: QualityReport | null;
  profileName: string | null;
  onSaveProfile: () => void;
  onBack: () => void;
  onContinue: () => void;
  busy: boolean;
}

export function MappingReview({
  sheet,
  schema,
  mapping,
  onMappingChange,
  quality,
  profileName,
  onSaveProfile,
  onBack,
  onContinue,
  busy,
}: MappingReviewProps) {
  const [previewFilter, setPreviewFilter] = useState<number[] | null>(null);

  const setColumn = (index: number, patch: Partial<ImportMapping["columns"][number]>) => {
    onMappingChange({
      ...mapping,
      columns: mapping.columns.map((column) =>
        column.index === index ? { ...column, ...patch } : column,
      ),
    });
  };

  // Live preview of the first 20 normalized rows (SPEC §5.3) — recomputed on
  // every mapping change from a slice, so it stays instant on huge files.
  const preview = useMemo(() => {
    const slice: ParsedSheet = {
      ...sheet,
      rowCount: Math.min(sheet.rowCount, 300),
      columns: sheet.columns.map((column) => ({
        ...column,
        cells: column.cells.slice(0, 300),
      })),
    };
    return normalizeRows(slice, mapping);
  }, [sheet, mapping]);

  const previewRows = useMemo(() => {
    if (!previewFilter) return preview.slice(0, 20);
    const wanted = new Set(previewFilter);
    return preview.filter((row) => wanted.has(row.rowIndex)).slice(0, 20);
  }, [preview, previewFilter]);

  const cross = schema.crossChecks;
  const ambiguousColumns = mapping.columns.filter(
    (column) =>
      column.include &&
      column.role === "period" &&
      schema.columns.find((c) => c.index === column.index)?.ambiguousDate,
  );

  const hasNameOrMeasure = mapping.columns.some(
    (column) => column.include && (column.role === "entity_name" || column.role === "quantity" || column.role === "total_amount"),
  );

  const qualityChip = (label: string, count: number, rows?: number[]) => (
    <Button
      key={label}
      variant={count > 0 ? "outline" : "ghost"}
      size="sm"
      disabled={count === 0 || !rows}
      onClick={() => setPreviewFilter(previewFilter === rows ? null : (rows ?? null))}
      className={cn(
        "h-8 gap-2",
        count > 0 && rows && previewFilter === rows && "border-ring bg-accent",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono", count > 0 ? "text-foreground" : "text-muted-foreground")}>
        {count}
      </span>
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      {profileName ? (
        <div className="flex items-center gap-2 rounded-lg border bg-chart-1/10 px-3 py-2 text-sm">
          <CircleCheck className="size-4" />
          Applied your saved mapping “{profileName}” — this file shape has been
          seen before. Adjust anything, then continue.
        </div>
      ) : null}

      {cross.qtyPriceTotal ? (
        cross.qtyPriceTotal.matchRate >= 0.9 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <CircleCheck className="size-4 text-muted-foreground" />
            <span>
              Quantity × price matches the total on{" "}
              <strong>{Math.round(cross.qtyPriceTotal.matchRate * 100)}%</strong> of rows
              {cross.qtyPriceTotal.anomalyRows.length > 0
                ? ` — ${cross.qtyPriceTotal.anomalyRows.length} rows disagree and are flagged below`
                : ""}
              .
            </span>
            <span className="ms-auto flex items-center gap-2">
              <span className="text-muted-foreground">Authoritative:</span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mapping.authoritativeAmount}
                onValueChange={(value) => {
                  if (value)
                    onMappingChange({
                      ...mapping,
                      authoritativeAmount: value as "total" | "unit_price",
                    });
                }}
              >
                <ToggleGroupItem value="total" className="px-3">Total</ToggleGroupItem>
                <ToggleGroupItem value="unit_price" className="px-3">Qty × price</ToggleGroupItem>
              </ToggleGroup>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <TriangleAlert className="size-4 text-destructive" />
            Quantity × price only matches the total on{" "}
            {Math.round(cross.qtyPriceTotal.matchRate * 100)}% of rows — check the
            column roles below.
          </div>
        )
      ) : null}

      {ambiguousColumns.map((column) => (
        <div
          key={column.index}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-chart-2/50 bg-chart-2/10 px-3 py-2 text-sm"
        >
          <TriangleAlert className="size-4" />
          <span>
            “{column.header}” has dates like 03/04/2026 that read both ways.
            Which order is it?
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={column.dateOrder}
            onValueChange={(value) => {
              if (value) setColumn(column.index, { dateOrder: value as "DMY" | "MDY" });
            }}
          >
            <ToggleGroupItem value="DMY" className="px-3">Day / Month</ToggleGroupItem>
            <ToggleGroupItem value="MDY" className="px-3">Month / Day</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ))}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Column mapping</CardTitle>
            <CardDescription>
              What Farmstead detected — correct anything it got wrong.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={mapping.currency}
              onValueChange={(currency) => onMappingChange({ ...mapping, currency })}
            >
              <SelectTrigger className="w-24" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mapping.defaultTransactionType}
              onValueChange={(value) =>
                onMappingChange({
                  ...mapping,
                  defaultTransactionType: value as ImportMapping["defaultTransactionType"],
                })
              }
            >
              <SelectTrigger className="w-36" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["sale", "purchase", "birth", "death", "consumption", "adjustment", "expense"].map(
                  (type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      Default: {type}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Meaning</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Samples</TableHead>
                <TableHead className="text-end">Include</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapping.columns.map((column) => {
                const inferred = schema.columns.find((c) => c.index === column.index);
                return (
                  <TableRow key={column.index} className={cn(!column.include && "opacity-45")}>
                    <TableCell className="max-w-40">
                      <p className="truncate font-medium">{column.header}</p>
                      {inferred?.mixedUnits ? (
                        <p className="text-xs text-destructive">
                          Mixed units: {inferred.mixedUnits.join(", ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={column.type}
                        onValueChange={(value) =>
                          setColumn(column.index, { type: value as PhysicalType })
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((type) => (
                            <SelectItem key={type} value={type} className="capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={column.role}
                        onValueChange={(value) =>
                          setColumn(column.index, { role: value as SemanticRole })
                        }
                      >
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {inferred ? <ConfidenceBadge value={Math.min(inferred.typeConfidence, inferred.roleConfidence)} /> : null}
                    </TableCell>
                    <TableCell className="max-w-48">
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {inferred?.samples.join(" · ") ?? ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-end">
                      <Switch
                        checked={column.include}
                        onCheckedChange={(include) => setColumn(column.index, { include })}
                        aria-label={`Include ${column.header}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {quality ? (
        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
            <CardDescription>
              Click a number to see the offending rows in the preview.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {qualityChip("Rows", quality.rowCount)}
            {qualityChip("Duplicates", quality.duplicateRows.length, quality.duplicateRows)}
            {qualityChip("Won't parse", quality.coercionFailures.length, quality.coercionFailures)}
            {qualityChip(
              "Qty×price ≠ total",
              quality.arithmeticAnomalies.length,
              quality.arithmeticAnomalies,
            )}
            {quality.outliers.map((outlier) =>
              qualityChip(`${outlier.header} outliers`, outlier.rowIndexes.length, outlier.rowIndexes),
            )}
            {quality.dateRange ? (
              <Badge variant="outline" className="h-8 gap-2 px-3 font-normal">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-mono">
                  {quality.dateRange.min} → {quality.dateRange.max}
                </span>
              </Badge>
            ) : null}
            {previewFilter ? (
              <Button variant="ghost" size="sm" onClick={() => setPreviewFilter(null)}>
                Clear filter
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            {previewFilter
              ? `Showing flagged rows (${previewRows.length})`
              : "The first rows, normalized with the mapping above"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-end">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-end">Unit price</TableHead>
                <TableHead className="text-end">Total</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row) => (
                <TableRow key={row.rowIndex} className={cn(row.problems.length > 0 && "bg-destructive/5")}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.rowIndex + 2}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.date ?? "—"}</TableCell>
                  <TableCell className="max-w-44 truncate">{row.productName ?? "—"}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{row.qty ?? "—"}</TableCell>
                  <TableCell className="text-xs">{row.unitCode ?? "—"}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{row.unitPrice ?? "—"}</TableCell>
                  <TableCell className="text-end font-mono text-xs">{row.total ?? "—"}</TableCell>
                  <TableCell className="max-w-36 truncate text-xs">{row.party ?? "—"}</TableCell>
                  <TableCell className="text-xs capitalize">
                    {row.type ?? mapping.defaultTransactionType}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Start over
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSaveProfile} disabled={busy}>
            Save as mapping profile
          </Button>
          <Button onClick={onContinue} disabled={busy || !hasNameOrMeasure}>
            Continue to matching
          </Button>
        </div>
      </div>
      {!hasNameOrMeasure ? (
        <p className="text-end text-sm text-muted-foreground">
          Map at least a product name, quantity or total column to continue.
        </p>
      ) : null}
    </div>
  );
}
