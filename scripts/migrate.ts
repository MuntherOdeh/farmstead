import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
    console.log("✓ migrations applied (remote Postgres)");
    return;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.pglite", { recursive: true }); // PGlite won't create parents
  const client = new PGlite("./.pglite/data");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.close();
  console.log("✓ migrations applied (local PGlite)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
