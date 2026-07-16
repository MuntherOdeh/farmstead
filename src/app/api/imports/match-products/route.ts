import { isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireUserApi } from "@/lib/auth/require-user";
import { handleRoute } from "@/lib/import/api-helpers";
import { matchRequestSchema } from "@/lib/import/api-schemas";
import { levenshtein, normalizeHeader } from "@/lib/import/text";

/**
 * Fuzzy-match imported product names to the catalogue (SPEC §5.4). The client
 * shows the matches for confirmation — nothing is auto-committed.
 */
export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    await requireUserApi();
    const body = matchRequestSchema.parse(await request.json());
    const db = await getDb();
    const catalogue = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(isNull(products.deletedAt));

    const normalized = catalogue.map((product) => ({
      ...product,
      key: normalizeHeader(product.name),
      tokens: new Set(normalizeHeader(product.name).split(" ")),
    }));

    const matches = body.names.map((name) => {
      const key = normalizeHeader(name);
      const tokens = key.split(" ");

      // 1) exact normalized match
      const exact = normalized.find((product) => product.key === key);
      if (exact) {
        return { name, productId: exact.id, productName: exact.name, score: 1 };
      }

      // 2) fuzzy: token overlap + edit distance
      let best: { id: string; name: string; score: number } | null = null;
      for (const product of normalized) {
        const overlap = tokens.filter((token) => product.tokens.has(token)).length;
        const tokenScore = overlap / Math.max(tokens.length, product.tokens.size);
        const distance = levenshtein(key, product.key);
        const editScore = 1 - distance / Math.max(key.length, product.key.length);
        const score = Math.max(tokenScore, editScore);
        if (score > (best?.score ?? 0)) {
          best = { id: product.id, name: product.name, score };
        }
      }
      if (best && best.score >= 0.55) {
        return {
          name,
          productId: best.id,
          productName: best.name,
          score: Number(best.score.toFixed(2)),
        };
      }
      return { name, productId: null, productName: null, score: 0 };
    });

    return Response.json({ matches });
  });
}
