import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;

// Without DATABASE_URL, drizzle-kit targets the local PGlite data dir the app
// falls back to in dev (src/db/index.ts).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: "./.pglite/data" } }),
});
