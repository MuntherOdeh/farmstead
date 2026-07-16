import { normalizeHeader } from "./text";

/**
 * Stable file-shape signature: sha256 of the SORTED normalized headers
 * (SPEC §5.3). The same columns in any order produce the same signature, so a
 * saved mapping profile auto-applies next month.
 */
export async function headerSignature(headers: string[]): Promise<string> {
  const canonical = JSON.stringify([...headers.map(normalizeHeader)].sort());
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
