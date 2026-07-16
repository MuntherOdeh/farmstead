import { count, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { getDb, schema, type Db } from "@/db";

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7-day cap (SPEC §4.2)
const SESSION_ROLL_AGE_S = 60 * 60 * 24; // rolling expiry: refresh daily

function createAuthInstance(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // There is no public sign-up, ever (SPEC §4). The admin is seeded from
      // env; further accounts are created by the admin in /settings.
      disableSignUp: true,
      minPasswordLength: 10,
    },
    session: {
      expiresIn: SESSION_MAX_AGE_S,
      updateAge: SESSION_ROLL_AGE_S,
    },
    rateLimit: {
      enabled: true,
      // Database storage so limits hold across serverless instances.
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        // 5 attempts / 15 minutes on credential endpoints (SPEC §4.2).
        "/sign-in/email": { window: 900, max: 5 },
        "/sign-in/username": { window: 900, max: 5 },
      },
    },
    // Role "user" is the read-only viewer; every mutation goes through
    // requireAdmin(), which demands role === "admin".
    plugins: [username(), admin({ defaultRole: "user", adminRoles: ["admin"] })],
  });
}

export type Auth = ReturnType<typeof createAuthInstance>;
export type SessionUser = Auth["$Infer"]["Session"]["user"];

/**
 * Seed the single admin account from env on first run (SPEC §4). Uses a
 * bootstrap instance with sign-up enabled — the public instance keeps
 * sign-up disabled — then promotes the account to the admin role.
 */
async function ensureAdmin(db: Db): Promise<void> {
  const [{ n }] = await db.select({ n: count() }).from(schema.user);
  if (n > 0) return;

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    console.warn(
      "[auth] no users exist and ADMIN_USERNAME/ADMIN_PASSWORD are not set — nobody can log in",
    );
    return;
  }

  const bootstrap = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    plugins: [username()],
  });
  await bootstrap.api.signUpEmail({
    body: {
      email: `${adminUsername}@farmstead.local`,
      password: adminPassword,
      name: "Administrator",
      username: adminUsername,
    },
  });
  await db
    .update(schema.user)
    .set({ role: "admin", emailVerified: true })
    .where(eq(schema.user.username, adminUsername));
  console.log(`[auth] seeded admin account "${adminUsername}"`);
}

const globalForAuth = globalThis as typeof globalThis & {
  __farmsteadAuth?: Promise<Auth>;
};

async function createAuth(): Promise<Auth> {
  const db = await getDb();
  await ensureAdmin(db);
  return createAuthInstance(db);
}

export function getAuth(): Promise<Auth> {
  globalForAuth.__farmsteadAuth ??= createAuth();
  return globalForAuth.__farmsteadAuth;
}
