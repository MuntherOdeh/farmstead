import Decimal from "decimal.js";
import { asc, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { loadLedger } from "@/lib/analytics/queries";
import { requireUser } from "@/lib/auth/require-user";
import { PartiesView, type PartySummary } from "@/components/parties/parties-view";

export const metadata: Metadata = { title: "Parties" };

export default async function PartiesPage() {
  await requireUser();
  const db = await getDb();
  const [partyRows, ledger] = await Promise.all([
    db
      .select({ id: parties.id, name: parties.name, type: parties.type })
      .from(parties)
      .where(isNull(parties.deletedAt))
      .orderBy(asc(parties.name)),
    loadLedger(),
  ]);

  const summaries: PartySummary[] = partyRows.map((party) => {
    const txns = ledger
      .filter((row) => row.partyId === party.id)
      .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
    let revenue = new Decimal(0);
    let spend = new Decimal(0);
    for (const tx of txns) {
      if (tx.type === "sale") revenue = revenue.plus(tx.total ?? 0);
      if (tx.type === "purchase" || tx.type === "expense") spend = spend.plus(tx.total ?? 0);
    }
    return {
      id: party.id,
      name: party.name,
      type: party.type,
      txCount: txns.length,
      revenue: revenue.toFixed(2),
      spend: spend.toFixed(2),
      lastActivity: txns[0]?.occurredOn ?? null,
      recent: txns.slice(0, 12).map((tx) => ({
        id: tx.id,
        occurredOn: tx.occurredOn,
        type: tx.type,
        productName: tx.productName,
        qty: tx.qty,
        total: tx.total,
      })),
    };
  });

  summaries.sort((a, b) => Number(b.revenue) + Number(b.spend) - (Number(a.revenue) + Number(a.spend)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Parties</h1>
        <p className="text-sm text-muted-foreground">
          Everyone you buy from and sell to, with their history and totals.
        </p>
      </div>
      <PartiesView parties={summaries} />
    </div>
  );
}
