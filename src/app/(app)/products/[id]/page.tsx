import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoney } from "@/lib/format";
import { productCalc } from "@/lib/products/calc";
import { getProductDetail, listAttributeDefs } from "@/lib/products/queries";
import {
  ProductHistoryChart,
  type MonthlyProductPoint,
} from "@/components/products/product-history-chart";

export const metadata: Metadata = { title: "Product" };

const money = (value: string | null) =>
  value === null ? "—" : formatMoney(Number(new Decimal(value).toFixed(2)));

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const detail = await getProductDetail(id);
  if (!detail) notFound();
  const { product, transactions, history } = detail;
  const defs = (await listAttributeDefs()).filter(
    (def) => def.categoryId === product.categoryId,
  );

  const calc = productCalc(product);

  // Monthly sales aggregation for the chart (Decimal all the way).
  const byMonth = new Map<string, { sold: Decimal; revenue: Decimal }>();
  for (const tx of transactions) {
    if (tx.type !== "sale") continue;
    const key = format(parseISO(tx.occurredOn), "MMM yy");
    const bucket = byMonth.get(key) ?? { sold: new Decimal(0), revenue: new Decimal(0) };
    bucket.sold = bucket.sold.plus(tx.qty);
    if (tx.total) bucket.revenue = bucket.revenue.plus(tx.total);
    byMonth.set(key, bucket);
  }
  const chartData: MonthlyProductPoint[] = [...byMonth.entries()]
    .reverse()
    .map(([month, value]) => ({
      month,
      sold: Number(value.sold.toFixed(2)),
      revenue: Number(value.revenue.toFixed(2)),
    }));

  const lowStock =
    product.reorderLevel !== null &&
    new Decimal(product.stockQty).lt(new Decimal(product.reorderLevel));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link href="/products">
            <ArrowLeft className="size-4" /> All products
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{product.name}</h1>
          <Badge variant="secondary">{product.categoryName}</Badge>
          {product.isActive ? (
            <Badge variant="outline">Active</Badge>
          ) : (
            <Badge variant="secondary">Archived</Badge>
          )}
          {lowStock ? <Badge variant="destructive">Low stock</Badge> : null}
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {product.sku ?? "no sku"}
          {product.species ? ` · ${product.species}` : ""}
          {product.breed ? ` · ${product.breed}` : ""}
        </p>
      </div>

      <div className="kpi grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="font-heading text-2xl font-semibold">{money(product.unitPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Cost</p>
            <p className="font-heading text-2xl font-semibold">{money(product.costPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Margin</p>
            <p className="font-heading text-2xl font-semibold">
              {calc.marginPct === null ? "—" : `${calc.marginPct}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Stock</p>
            <p className="font-heading text-2xl font-semibold">
              {new Decimal(product.stockQty).toFixed(0)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {product.unitCode}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Stock value</p>
            <p className="font-heading text-2xl font-semibold">
              {calc.stockValue === null ? "—" : formatMoney(Number(calc.stockValue))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales history</CardTitle>
            <CardDescription>Monthly revenue from this product</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No sales recorded yet.
              </p>
            ) : (
              <ProductHistoryChart data={chartData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {defs.length === 0 && !product.description && !product.notes ? (
              <p className="text-muted-foreground">No custom fields for this category.</p>
            ) : null}
            {defs.map((def) => {
              const value = product.attributes?.[def.key];
              return (
                <div key={def.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{def.label}</span>
                  <span className="text-end font-medium">
                    {value === undefined || value === null || value === ""
                      ? "—"
                      : typeof value === "boolean"
                        ? value
                          ? "Yes"
                          : "No"
                        : String(value)}
                  </span>
                </div>
              );
            })}
            {product.description ? (
              <p className="border-t pt-3 text-muted-foreground">{product.description}</p>
            ) : null}
            {product.notes ? (
              <p className="border-t pt-3 text-muted-foreground">{product.notes}</p>
            ) : null}
            {product.tags && product.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t pt-3">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Every ledger row that touches this product</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">None yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Party</TableHead>
                    <TableHead className="text-end">Qty</TableHead>
                    <TableHead className="text-end">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 50).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(parseISO(tx.occurredOn), "d MMM yy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden max-w-44 truncate text-muted-foreground md:table-cell">
                        {tx.partyName ?? "—"}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs">
                        {new Decimal(tx.qty).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs">
                        {tx.total ? money(tx.total) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change history</CardTitle>
            <CardDescription>Audit trail for this product</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No changes recorded.
              </p>
            ) : (
              <ol className="flex flex-col gap-3 text-sm">
                {history.slice(0, 20).map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3">
                    <span className="capitalize">{entry.action.replace(/-/g, " ")}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(entry.at, "d MMM yy, HH:mm")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
