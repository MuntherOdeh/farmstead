import { CircleCheck, Info, Palette, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinancialSummary, MoneyTable } from "@/lib/import/financial-summary";
import { cn } from "@/lib/utils";

// Dedicated rendering for the owner's Arabic financial-summary sheets — the
// whole view is RTL because the content is Arabic. Everything shown comes
// straight from the sheet, including block titles.

const n = (value: number, digits = 0) =>
  value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const BAR_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function tableTotal(table: MoneyTable) {
  return table.rows.find((row) => row.isTotal) ?? table.rows.at(-1) ?? null;
}

export function FinancialSummaryView({ summary }: { summary: FinancialSummary }) {
  const { sections, total, expensesFootnote, tables, legend, notes } = summary;
  const maxAmount = Math.max(...sections.map((s) => s.amount), 1);
  const hasOriginals = sections.some((s) => s.original !== null) || total?.original !== null;
  const mismatched = sections.filter((s) => s.diff !== null && s.diff !== 0);

  return (
    <div dir="rtl" className="flex flex-col gap-4 md:gap-6">
      {/* KPI row */}
      <div className="kpi grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{total?.label ?? "إجمالي المصاريف"}</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              ${total ? n(total.amount) : "—"}
            </p>
            {total && total.original !== null && total.diff !== 0 ? (
              <p className="text-sm text-muted-foreground">
                الأصل المكتوب يدوياً: ${n(total.original)}{" "}
                <span className="text-destructive">
                  ({total.diff! > 0 ? "+" : ""}
                  {n(total.diff!)})
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">عبر {sections.length} أقسام</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">عدد البنود المسجّلة</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {total ? n(total.itemCount) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">بند مصروف</p>
          </CardContent>
        </Card>
        {tables.slice(0, 2).map((table) => {
          const totalRow = tableTotal(table);
          if (!totalRow) return null;
          return (
            <Card key={table.title}>
              <CardContent>
                <p className="truncate text-sm text-muted-foreground">{table.title}</p>
                <p className="font-heading text-3xl font-semibold tracking-tight">
                  {n(totalRow.amount, 2)}{" "}
                  <span className="text-base font-normal">
                    {totalRow.currency ?? "ليرة"}
                  </span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {totalRow.label}
                  {totalRow.usdEquivalent !== null && totalRow.usdEquivalent !== totalRow.amount
                    ? ` · ما يعادله ($): ${n(totalRow.usdEquivalent, 4)}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {mismatched.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-chart-2/50 bg-chart-2/10 px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {mismatched.length === 1 ? "قسم واحد لا يطابق" : `${mismatched.length} أقسام لا تطابق`}{" "}
            الإجمالي المكتوب يدوياً في الملف الأصلي:{" "}
            {mismatched
              .map((s) => `${s.label} (${s.diff! > 0 ? "+" : ""}${n(s.diff!)})`)
              .join("، ")}
            {" — "}راجع الملاحظات أدناه.
          </p>
        </div>
      ) : null}

      {/* Expenses by section */}
      <Card>
        <CardHeader>
          <CardTitle>المصاريف حسب القسم</CardTitle>
          <CardDescription>
            {expensesFootnote ?? "كما وردت في ورقة الملخص — المبالغ بالدولار"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">القسم</TableHead>
                <TableHead className="w-2/5 text-start">الحصة</TableHead>
                <TableHead className="text-end">المبلغ ($)</TableHead>
                <TableHead className="text-end">النسبة</TableHead>
                <TableHead className="text-end">عدد البنود</TableHead>
                {hasOriginals ? (
                  <>
                    <TableHead className="text-end">الأصل</TableHead>
                    <TableHead className="text-end">الفرق</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section, index) => (
                <TableRow key={section.label}>
                  <TableCell className="font-medium">{section.label}</TableCell>
                  <TableCell>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", BAR_COLORS[index % BAR_COLORS.length])}
                        style={{
                          width: `${Math.max(1, Math.round((section.amount / maxAmount) * 100))}%`,
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-end font-mono text-sm">{n(section.amount)}</TableCell>
                  <TableCell className="text-end font-mono text-xs text-muted-foreground">
                    {section.sharePct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs">{n(section.itemCount)}</TableCell>
                  {hasOriginals ? (
                    <>
                      <TableCell className="text-end font-mono text-xs text-muted-foreground">
                        {section.original !== null ? n(section.original) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {section.diff === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : section.diff === 0 ? (
                          <CircleCheck className="ms-auto size-4 text-muted-foreground" />
                        ) : (
                          <span className="font-mono text-xs text-destructive">
                            {section.diff > 0 ? "+" : ""}
                            {n(section.diff)}
                          </span>
                        )}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))}
              {total ? (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>{total.label}</TableCell>
                  <TableCell />
                  <TableCell className="text-end font-mono text-sm">{n(total.amount)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">100%</TableCell>
                  <TableCell className="text-end font-mono text-xs">{n(total.itemCount)}</TableCell>
                  {hasOriginals ? (
                    <>
                      <TableCell className="text-end font-mono text-xs text-muted-foreground">
                        {total.original !== null ? n(total.original) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {total.diff !== null && total.diff !== 0 ? (
                          <span className="font-mono text-xs text-destructive">
                            {total.diff > 0 ? "+" : ""}
                            {n(total.diff)}
                          </span>
                        ) : (
                          <CircleCheck className="ms-auto size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Money tables — titles come from the sheet itself */}
      {tables.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {tables.map((table) => (
            <Card key={table.title}>
              <CardHeader>
                <CardTitle>{table.title}</CardTitle>
                <CardDescription>
                  {table.hasCurrency
                    ? "بنود بعملات مختلفة مع مقابلها بالدولار — كما وردت في الملف"
                    : "المبالغ بالليرة وما يعادلها بالدولار — كما وردت في الملف"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">البند</TableHead>
                      <TableHead className="text-end">
                        {table.hasCurrency ? "المبلغ" : "المبلغ (ليرة)"}
                      </TableHead>
                      {table.hasCurrency ? (
                        <TableHead className="text-end">العملة</TableHead>
                      ) : null}
                      <TableHead className="text-end">ما يعادله ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.rows.map((row) => (
                      <TableRow
                        key={row.label}
                        className={cn(row.isTotal && "border-t-2 font-semibold")}
                      >
                        <TableCell className="max-w-52 truncate">{row.label}</TableCell>
                        <TableCell className="text-end font-mono text-sm">
                          {n(row.amount, 2)}
                        </TableCell>
                        {table.hasCurrency ? (
                          <TableCell className="text-end">
                            <Badge variant="outline">{row.currency ?? "—"}</Badge>
                          </TableCell>
                        ) : null}
                        <TableCell className="text-end font-mono text-sm">
                          {row.usdEquivalent !== null ? n(row.usdEquivalent, 4) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {notes.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4" /> ملاحظات ومسائل تحتاج تأكيد
              </CardTitle>
              <CardDescription>منقولة حرفياً من ورقة الملخص</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm leading-6">
                {notes.map((note) => (
                  <li key={note.slice(0, 40)} className="rounded-lg border bg-muted/30 p-3">
                    {note}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}

        {legend.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-4" /> دليل الألوان في الملف الأصلي
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {legend.map((line) => (
                <p key={line} className="rounded-md border px-3 py-2">
                  {line}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
