import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { getDb } = await import("../src/db");
  const { seedDatabase } = await import("../src/db/seed");
  const db = await getDb();
  const summary = await seedDatabase(db);
  console.log(
    `✓ seeded ${summary.products} products, ${summary.parties} parties, ` +
      `${summary.transactions} transactions across ${summary.months} months`,
  );
  console.log("  closing herd:", summary.herdClosing);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
