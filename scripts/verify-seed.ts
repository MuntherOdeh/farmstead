import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

// Sanity checks over the seeded data: row distribution, date coverage, the
// herd-movement identity for a livestock product, and the presence of the
// deliberate demo anomalies (SPEC §14).

async function main() {
  const { getDb } = await import("../src/db");
  const { transactions, products } = await import("../src/db/schema");
  const { sql, eq } = await import("drizzle-orm");
  const db = await getDb();

  const byType = await db
    .select({ type: transactions.type, n: sql<number>`count(*)::int` })
    .from(transactions)
    .groupBy(transactions.type);
  console.log("rows by type:", Object.fromEntries(byType.map((r) => [r.type, r.n])));

  const [range] = await db
    .select({
      min: sql<string>`min(${transactions.occurredOn})`,
      max: sql<string>`max(${transactions.occurredOn})`,
    })
    .from(transactions);
  console.log(`date range: ${range.min} → ${range.max}`);

  // Herd reconciliation identity for Awassi ewe (seed opening = 96):
  const [ewe] = await db.select().from(products).where(eq(products.sku, "FS-0001"));
  const moves = await db
    .select({ type: transactions.type, q: sql<string>`sum(${transactions.qty})` })
    .from(transactions)
    .where(eq(transactions.productId, ewe.id))
    .groupBy(transactions.type);
  const moved = (t: string) => Number(moves.find((m) => m.type === t)?.q ?? 0);
  const opening = 96;
  const computed =
    opening +
    moved("birth") +
    moved("purchase") -
    moved("sale") -
    moved("death") -
    moved("consumption");
  const stored = Number(ewe.stockQty);
  console.log(
    `FS-0001: ${opening} opening +${moved("birth")} births +${moved("purchase")} purchases ` +
      `-${moved("sale")} sales -${moved("death")} deaths -${moved("consumption")} consumption = ${computed} ` +
      `(stock_qty ${stored})`,
  );
  if (computed !== stored) {
    throw new Error("herd reconciliation does NOT balance");
  }

  const [{ n: anomalies }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(sql`${transactions.notes} like '%demo anomaly%'`);
  console.log(`anomaly rows: ${anomalies}`);
  if (anomalies < 4) throw new Error("expected at least 4 seeded anomalies");

  console.log("✓ seed verifies");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
