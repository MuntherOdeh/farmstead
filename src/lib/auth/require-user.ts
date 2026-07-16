import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, type SessionUser } from "./index";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Session lookup, deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // headers() first: during `next build` it bails the page out to dynamic
  // rendering BEFORE getAuth() can touch the database.
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
});

/**
 * The first line of every server component that touches data (SPEC §4.1).
 * Middleware is a UX redirect only — this is the real gate.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers and server actions — throws instead of redirecting. */
export async function requireUserApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Mutating operations are admin-only; viewers are read-only (SPEC §4). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUserApi();
  if (user.role !== "admin") throw new UnauthorizedError("Admin access required");
  return user;
}
