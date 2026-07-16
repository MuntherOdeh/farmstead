import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/require-user";

// Route-handler plumbing: consistent JSON errors, no stack traces to clients.

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export async function handleRoute(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(403, "You don't have permission to do that.");
    }
    if (error instanceof ZodError) {
      return jsonError(400, `Invalid request: ${error.issues[0]?.message ?? "bad input"}`);
    }
    console.error("[import-api]", error);
    return jsonError(500, "Something went wrong.");
  }
}
