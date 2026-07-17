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
import type { FinancialSummary } from "@/lib/import/financial-summary";
import { cn } from "@/lib/utils";

// Dedicated rendering for the owner's Arabic financial-summary sheets — the
// whole view is RTL because the content is Arabic.

const n = (value: number, digits = 0) =>
  value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function FinancialSummaryView({ summary }: { summary: FinancialSummary }) {
  const { sections, total, expensesFootnote, sales, receipts, legend, notes } = summary;
  const maxAmount = Math.max(...sections.map((s) => s.amount), 1);
  const mismatched = sections.filter((s) => s.diff !== null && s.diff !== 0);
  const salesTotal = sales.find((s) => s.label.includes("إجمالي"));
  const salesRows = sales.filter((s) => !s.label.includes("إجمالي"));

  return (
    <div dir="rtl" className="flex flex-col gap-4 md:gap-6">
      {/* KPI row */}
      <div className="kpi grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              ${total ? n(total.amount) : "—"}
            </p>
            {total?.original !== null && total?.diff !== 0 ? (
              <p className="text-sm text-muted-foreground">
                الأصل المكتوب يدوياً: ${n(total!.original!)}{" "}
                <span className="text-destructive">({total!.diff! > 0 ? "+" : ""}{n(total!.diff!)})</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">عدد البنود المسجّلة</p>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {total ? n(total.itemCount) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">عبر {sections.length} أقسام</p>
          </CardContent>
        </Card>
        {salesTotal ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">{salesTotal.label}</p>
              <p className="font-heading text-3xl font-semibold tracking-tight">
                {n(salesTotal.amountLira, 2)} <span className="text-base font-normal">ليرة</span>
              </p>
              {salesTotal.usdEquivalent !== null ? (
                <p className="text-sm text-muted-foreground">
                  ما يعادله بالدولار كما ورد: {n(salesTotal.usdEquivalent, 4)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {receipts.length > 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">{receipts[0].label}</p>
              <p className="font-heading text-3xl font-semibold tracking-tight">
                {n(receipts[0].amount)}{" "}
                <span className="text-base font-normal">{receipts[0].currency}</span>
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {mismatched.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-chart-2/50 bg-chart-2/10 px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            {mismatched.length === 1 ? "قسم واحد لا يطابق" : `${mismatched.length} أقسام لا تطابق`}{" "}
            الإجمالي المكتوب يدوياً في الملف الأصلي:{" "}
            {mismatched.map((s) => `${s.label} (${s.diff! > 0 ? "+" : ""}${n(s.diff!)})`).join("، ")}
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
                <TableHead className="text-end">الأصل</TableHead>
                <TableHead className="text-end">الفرق</TableHead>
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
                        style={{ width: `${Math.max(1, Math.round((section.amount / maxAmount) * 100))}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-end font-mono text-sm">{n(section.amount)}</TableCell>
                  <TableCell className="text-end font-mono text-xs text-muted-foreground">
                    {section.sharePct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-end font-mono text-xs">{n(section.itemCount)}</TableCell>
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
                </TableRow>
              ))}
              {total ? (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>{total.label}</TableCell>
                  <TableCell />
                  <TableCell className="text-end font-mono text-sm">{n(total.amount)}</TableCell>
                  <TableCell className="text-end font-mono text-xs">100%</TableCell>
                  <TableCell className="text-end font-mono text-xs">{n(total.itemCount)}</TableCell>
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
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales */}
        {sales.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>المبيعات</CardTitle>
              <CardDescription>المبالغ بالليرة وما يعادلها بالدولار — كما وردت في الملف</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">البند</TableHead>
                    <TableHead className="text-end">المبلغ (ليرة)</TableHead>
                    <TableHead className="text-end">ما يعادله ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...salesRows, ...(salesTotal ? [salesTotal] : [])].map((row) => (
                    <TableRow
                      key={row.label}
                      className={cn(row.label.includes("إجمالي") && "border-t-2 font-semibold")}
                    >
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-end font-mono text-sm">
                        {n(row.amountLira, 2)}
                      </TableCell>
                      <TableCell className="text-end font-mono text-sm">
                        {row.usdEquivalent !== null ? n(row.usdEquivalent, 4) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {/* Receipts & other expenses */}
        {receipts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>المقبوضات والمصاريف الأخرى</CardTitle>
              <CardDescription>بنود بعملات مختلفة مع مقابلها بالدولار</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">البند</TableHead>
                    <TableHead className="text-end">المبلغ</TableHead>
                    <TableHead className="text-end">العملة</TableHead>
                    <TableHead className="text-end">ما يعادله ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="max-w-52 truncate">{row.label}</TableCell>
                      <TableCell className="text-end font-mono text-sm">{n(row.amount)}</TableCell>
                      <TableCell className="text-end">
                        <Badge variant="outline">{row.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-end font-mono text-sm">
                        {row.usdEquivalent !== null ? n(row.usdEquivalent, 2) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Notes */}
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

        {/* Colour legend */}
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
