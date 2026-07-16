import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { loadLedger } from "@/lib/analytics/queries";
import { TransactionsView, type TxRow } from "@/components/transactions/transactions-view";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const user = await requireUser();
  const ledger = await loadLedger();

  const rows: TxRow[] = ledger
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1))
    .map((row) => ({
      id: row.id,
      type: row.type,
      occurredOn: row.occurredOn,
      productName: row.productName,
      categoryName: row.categoryName,
      partyName: row.partyName,
      qty: row.qty,
      unitCode: row.unitCode,
      unitPrice: row.unitPrice,
      total: row.total,
      source: row.source,
      notes: row.notes,
    }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Every sale, purchase, birth, death and expense — filter, edit, export.
        </p>
      </div>
      <TransactionsView rows={rows} canEdit={user.role === "admin"} />
    </div>
  );
}
