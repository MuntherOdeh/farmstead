"use client";

import { ChevronDown, Eye, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataExplorer, type ExplorerRow } from "@/components/data/data-explorer";
import { WidgetCard } from "@/components/data/widget-card";
import { saveDashboardLayout, type DashboardLayout } from "@/lib/dashboard/actions";
import { generateWidgets, type WidgetKind, type WidgetSpec } from "@/lib/dashboard/widgets";
import type { ImportMapping, NormalizedRow } from "@/lib/import/types";

const TOP_COUNT = 8;
const ROW_FETCH_LIMIT = 2000;
const MAX_ROWS = 20000;

interface FetchedRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  normalized: NormalizedRow;
}

interface DataDashboardProps {
  importId: string;
  filename: string;
  mapping: ImportMapping;
  rowCount: number;
  initialLayout: DashboardLayout | null;
}

export function DataDashboard({
  importId,
  filename,
  mapping,
  rowCount,
  initialLayout,
}: DataDashboardProps) {
  const [rows, setRows] = useState<FetchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const collected: FetchedRow[] = [];
        for (let offset = 0; offset < Math.min(rowCount, MAX_ROWS); offset += ROW_FETCH_LIMIT) {
          const response = await fetch(
            `/api/imports/${importId}/rows?offset=${offset}&limit=${ROW_FETCH_LIMIT}`,
          );
          if (!response.ok) throw new Error(`Loading rows failed (${response.status})`);
          const data = (await response.json()) as { rows: FetchedRow[] };
          collected.push(...data.rows);
          if (cancelled || data.rows.length < ROW_FETCH_LIMIT) break;
        }
        if (!cancelled) setRows(collected);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Loading failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importId, rowCount]);

  const normalizedRows = useMemo(() => rows.map((row) => row.normalized), [rows]);
  const widgets = useMemo(
    () => (normalizedRows.length > 0 ? generateWidgets(mapping, normalizedRows) : []),
    [mapping, normalizedRows],
  );
  const widgetById = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);

  // Layout: persisted per dataset per user; new widgets appended at the end.
  const [order, setOrder] = useState<string[]>(initialLayout?.order ?? []);
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialLayout?.hidden ?? []));
  const [pinned, setPinned] = useState<Set<string>>(new Set(initialLayout?.pinned ?? []));
  const [kinds, setKinds] = useState<Record<string, string>>(initialLayout?.kinds ?? {});

  const orderedIds = useMemo(() => {
    const known = order.filter((id) => widgetById.has(id));
    const fresh = widgets.map((w) => w.id).filter((id) => !known.includes(id));
    const merged = [...known, ...fresh];
    return [
      ...merged.filter((id) => pinned.has(id)),
      ...merged.filter((id) => !pinned.has(id)),
    ];
  }, [order, widgets, widgetById, pinned]);

  // Persist on change (debounced) — skip the initial render.
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      void saveDashboardLayout({
        datasetRef: importId,
        layout: { order: orderedIds, hidden: [...hidden], pinned: [...pinned], kinds },
      }).then((result) => {
        if (!result.ok) toast.error(result.error);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [orderedIds, hidden, pinned, kinds, importId]);

  const touch = useCallback(() => {
    dirty.current = true;
  }, []);

  const dragId = useRef<string | null>(null);
  const reorder = useCallback(
    (targetId: string) => {
      const sourceId = dragId.current;
      dragId.current = null;
      if (!sourceId || sourceId === targetId) return;
      touch();
      setOrder(() => {
        const current = [...orderedIds];
        const from = current.indexOf(sourceId);
        const to = current.indexOf(targetId);
        if (from === -1 || to === -1) return current;
        current.splice(from, 1);
        current.splice(to, 0, sourceId);
        return current;
      });
    },
    [orderedIds, touch],
  );

  const [drill, setDrill] = useState<{ widget: WidgetSpec; label: string | null } | null>(null);
  const drillRows = useMemo(() => {
    if (!drill) return [];
    const indexes = drill.label
      ? new Set(drill.widget.rowsByLabel[drill.label] ?? [])
      : new Set(Object.values(drill.widget.rowsByLabel).flat());
    return rows.filter((row) => indexes.has(row.rowIndex)).slice(0, 200);
  }, [drill, rows]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading {rowCount} rows…</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="font-medium">Couldn&apos;t load the data</p>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const visibleIds = orderedIds.filter((id) => !hidden.has(id));
  const topIds = visibleIds.slice(0, TOP_COUNT);
  const moreIds = visibleIds.slice(TOP_COUNT);
  const hiddenWidgets = orderedIds.filter((id) => hidden.has(id));

  const renderCard = (id: string) => {
    const widget = widgetById.get(id);
    if (!widget) return null;
    const kind = (kinds[id] as WidgetKind | undefined) ?? widget.kind;
    return (
      <WidgetCard
        key={id}
        widget={widget}
        kind={kind}
        pinned={pinned.has(id)}
        canReorder
        onKindChange={(next) => {
          touch();
          setKinds((current) => ({ ...current, [id]: next }));
        }}
        onPinToggle={() => {
          touch();
          setPinned((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onHide={() => {
          touch();
          setHidden((current) => new Set(current).add(id));
        }}
        onViewRows={(label) => setDrill({ widget, label })}
        onDragStart={() => {
          dragId.current = id;
        }}
        onDropOn={() => reorder(id)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">{topIds.map(renderCard)}</div>

      {moreIds.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              More charts ({moreIds.length}) <ChevronDown className="size-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4 lg:grid-cols-2">{moreIds.map(renderCard)}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {hiddenWidgets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Hidden:</span>
          {hiddenWidgets.map((id) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              onClick={() => {
                touch();
                setHidden((current) => {
                  const next = new Set(current);
                  next.delete(id);
                  return next;
                });
              }}
            >
              <Eye className="size-3.5" /> {widgetById.get(id)?.title ?? id}
            </Button>
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">Data explorer</h2>
        <DataExplorer
          rows={rows.map((row): ExplorerRow => ({ rowIndex: row.rowIndex, raw: row.raw }))}
          mapping={mapping}
        />
      </section>

      <Sheet open={drill !== null} onOpenChange={(open) => !open && setDrill(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{drill?.widget.title}</SheetTitle>
            <SheetDescription>
              {drill?.label ? `Rows behind “${drill.label}”` : "All underlying rows"} · from{" "}
              {filename}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-end">Qty</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                  <TableHead>Party</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillRows.map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.rowIndex + 2}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.normalized.date ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {row.normalized.productName ?? "—"}
                    </TableCell>
                    <TableCell className="text-end font-mono text-xs">
                      {row.normalized.qty ?? "—"}
                    </TableCell>
                    <TableCell className="text-end font-mono text-xs">
                      {row.normalized.total ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-xs">
                      {row.normalized.party ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {drill && drillRows.length === 200 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Showing the first 200 rows.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono">{rows.length} rows</Badge>
        <span>Drag cards to reorder — the layout is saved for you.</span>
      </div>
    </div>
  );
}
