import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Cached across HMR reloads in dev so PGlite's data dir is opened once.
const globalForDb = globalThis as typeof globalThis & {
  __farmsteadDb?: Promise<Db>;
};

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    return drizzleNeon(neon(url), { schema });
  }
  // No DATABASE_URL → local development fallback: PGlite, an embedded
  // file-backed Postgres. Production always sets DATABASE_URL (Neon).
  // See docs/DECISIONS.md "PGlite for local development".
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.pglite", { recursive: true }); // PGlite won't create parents
  const client = new PGlite("./.pglite/data");
  return drizzlePglite(client, { schema });
}

export function getDb(): Promise<Db> {
  globalForDb.__farmsteadDb ??= createDb();
  return globalForDb.__farmsteadDb;
}

export { schema };
