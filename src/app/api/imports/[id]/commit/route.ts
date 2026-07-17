import Decimal from "decimal.js";
import { asc, eq, isNull, and } from "drizzle-orm";
import { format } from "date-fns";
import { getDb } from "@/db";
import { auditLog, categories, importRows, imports, parties, products, transactions, units } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-user";
import { handleRoute, jsonError } from "@/lib/import/api-helpers";
import { commitSchema, type NormalizedRowWire } from "@/lib/import/api-schemas";
import { normalizeHeader } from "@/lib/import/text";

type Params = { params: Promise<{ id: string }> };

const asMoney = (value: string | null) =>
  value === null ? null : new Decimal(value).toDecimalPlaces(4).toFixed(4);

// Arabic farm-section names → category kinds, so sections imported from the
// owner's ledgers land with sensible kinds. Anything unknown becomes "other".
const ARABIC_KINDS: Array<[RegExp, "livestock" | "dairy" | "apiary" | "crop" | "input" | "equipment" | "other"]> = [
  [/نحل|عسل/, "apiary"],
  [/غنم|خروف|أغنام|ماعز|بقر|عجل|دواجن|دجاج/, "livestock"],
  [/حليب|جبنة|لبن|ألبان|قريشة|سمنة/, "dairy"],
  [/زراعة|محصول|زيتون|قمح/, "crop"],
  [/وقود|أعلاف|علف|بناء|سماد/, "input"],
  [/معدات|آليات|أدوات/, "equipment"],
];

/** Slug that stays unique for non-Latin names (plain slugify strips Arabic). */
const anySlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
  `cat-${Buffer.from(name).toString("hex").slice(0, 24)}`;

/**
 * Turn stored normalized rows into real ledger rows (SPEC §5.4). Everything
 * created here is recorded on the import batch so rollback removes the whole
 * import and everything it created in one click.
 */
export async function POST(request: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const user = await requireAdmin();
    const { id } = await params;
    const body = commitSchema.parse(await request.json());
    const db = await getDb();

    const [batch] = await db.select().from(imports).where(eq(imports.id, id));
    if (!batch) return jsonError(404, "Import not found");
    if (batch.status === "committed") return jsonError(409, "Already committed");
    await db.update(imports).set({ status: "committing" }).where(eq(imports.id, id));

    // Reference-only: keep the dataset, touch nothing in the ledger.
    if (body.referenceOnly) {
      await db
        .update(imports)
        .set({
          status: "committed",
          mapping: {
            ...(batch.mapping as Record<string, unknown>),
            referenceOnly: true,
            matches: [],
            createdProductIds: [],
            createdPartyIds: [],
          },
        })
        .where(eq(imports.id, id));
      await db.insert(auditLog).values({
        actorId: user.id,
        entity: "import",
        entityId: id,
        action: "commit-reference-only",
      });
      return Response.json({
        transactions: 0,
        createdProducts: 0,
        createdParties: 0,
        skippedNoProduct: 0,
        skippedByChoice: 0,
        referenceOnly: true,
      });
    }

    const mapping = batch.mapping as {
      currency: string;
      defaultTransactionType: NormalizedRowWire["type"];
    };
    const currency = mapping.currency ?? "USD";
    const defaultType = mapping.defaultTransactionType ?? "sale";

    const storedRows = await db
      .select({ rowIndex: importRows.rowIndex, normalized: importRows.normalized })
      .from(importRows)
      .where(eq(importRows.importId, id))
      .orderBy(asc(importRows.rowIndex));

    // Resolve units by code (normalized), bootstrapping the essentials on a
    // completely fresh database so a first import never dead-ends.
    let unitRows = await db.select().from(units);
    if (unitRows.length === 0) {
      await db.insert(units).values([
        { code: "pcs", label: "Piece", dimension: "count", toBaseFactor: "1", isSystem: true },
        { code: "head", label: "Head", dimension: "count", toBaseFactor: "1", isSystem: true },
        { code: "kg", label: "Kilogram", dimension: "mass", toBaseFactor: "1", isSystem: true },
        { code: "L", label: "Litre", dimension: "volume", toBaseFactor: "1", isSystem: true },
      ]);
      unitRows = await db.select().from(units);
    }
    const unitByCode = new Map(unitRows.map((u) => [normalizeHeader(u.code), u.id]));
    const fallbackUnitId =
      unitByCode.get("pcs") ?? unitByCode.get("head") ?? unitRows[0].id;

    // Category fallback for created products.
    let categoryRows = await db.select().from(categories).where(isNull(categories.deletedAt));
    if (categoryRows.length === 0) {
      await db
        .insert(categories)
        .values({ name: "Other", slug: "other", kind: "other", isSystem: true });
      categoryRows = await db.select().from(categories).where(isNull(categories.deletedAt));
    }
    const otherCategory =
      categoryRows.find((c) => c.slug === "other")?.id ?? categoryRows[0].id;

    // Per-product context from the rows: the قسم/category column and any
    // unit parsed out of the item names ("عدد 6" → head, "33كغ" → kg).
    const categoryNameByProduct = new Map<string, string>();
    const unitCodeByProduct = new Map<string, string>();
    for (const stored of storedRows) {
      const row = stored.normalized as NormalizedRowWire;
      if (!row.productName) continue;
      const key = normalizeHeader(row.productName);
      if (row.categoryName && !categoryNameByProduct.has(key)) {
        categoryNameByProduct.set(key, row.categoryName.trim());
      }
      if (row.unitCode && !unitCodeByProduct.has(key)) {
        unitCodeByProduct.set(key, row.unitCode);
      }
    }

    // Find-or-create categories named in the file (Arabic names welcome).
    const categoryIdByName = new Map(
      categoryRows.map((c) => [normalizeHeader(c.name), c.id]),
    );
    const createdCategoryIds: string[] = [];
    async function resolveCategory(name: string): Promise<string> {
      const key = normalizeHeader(name);
      const existing = categoryIdByName.get(key);
      if (existing) return existing;
      const kind = ARABIC_KINDS.find(([re]) => re.test(name))?.[1] ?? "other";
      const [row] = await db
        .insert(categories)
        .values({ name, slug: anySlug(name), kind, isSystem: false, createdBy: user.id })
        .returning({ id: categories.id });
      categoryIdByName.set(key, row.id);
      createdCategoryIds.push(row.id);
      return row.id;
    }

    // Product resolution per the confirmed matches.
    const matchByName = new Map(
      body.matches.map((match) => [normalizeHeader(match.name), match]),
    );
    const createdProductIds: string[] = [];
    const createdPartyIds: string[] = [];
    const productIdByName = new Map<string, string>();
    for (const match of body.matches) {
      const key = normalizeHeader(match.name);
      if (match.action === "map" && match.productId) {
        productIdByName.set(key, match.productId);
      } else if (match.action === "create") {
        const sectionName = categoryNameByProduct.get(key);
        const categoryId =
          match.categoryId ??
          (sectionName ? await resolveCategory(sectionName) : otherCategory);
        const parsedUnit = unitCodeByProduct.get(key);
        const unitId =
          (parsedUnit ? unitByCode.get(normalizeHeader(parsedUnit)) : undefined) ??
          fallbackUnitId;
        const [row] = await db
          .insert(products)
          .values({
            name: match.name,
            categoryId,
            unitId,
            currency,
            stockQty: "0.0000",
            attributes: {},
            notes: `Created by import ${batch.filename}`,
          })
          .returning({ id: products.id });
        productIdByName.set(key, row.id);
        createdProductIds.push(row.id);
      }
    }

    // Parties find-or-create by normalized name.
    const partyRows = await db.select().from(parties).where(isNull(parties.deletedAt));
    const partyByName = new Map(partyRows.map((p) => [normalizeHeader(p.name), p.id]));

    type TxInsert = typeof transactions.$inferInsert;
    const txValues: TxInsert[] = [];
    let skippedNoProduct = 0;
    let skippedByChoice = 0;

    // Subtotal/total pseudo-rows are layout, not data — never ledger them.
    // NOTE: \b is useless after Arabic letters, so use exact/prefix tests.
    const isSubtotalName = (name: string) => {
      const trimmed = name.trim();
      return (
        /^(مدفوع|غير مدفوع|المجموع)$/.test(trimmed) ||
        /^(إجمالي|الإجمالي|الاجمالي)/.test(trimmed) ||
        /^total\b/i.test(trimmed)
      );
    };

    for (const stored of storedRows) {
      const row = stored.normalized as NormalizedRowWire;
      if (row.productName && isSubtotalName(row.productName)) {
        skippedNoProduct++;
        continue;
      }
      const nameKey = row.productName ? normalizeHeader(row.productName) : null;
      const match = nameKey ? matchByName.get(nameKey) : undefined;
      if (match?.action === "skip") {
        skippedByChoice++;
        continue;
      }
      const productId = nameKey ? productIdByName.get(nameKey) : undefined;
      if (!productId) {
        skippedNoProduct++;
        continue;
      }

      let partyId: string | null = null;
      if (row.party) {
        const partyKey = normalizeHeader(row.party);
        partyId = partyByName.get(partyKey) ?? null;
        if (!partyId) {
          const [created] = await db
            .insert(parties)
            .values({ name: row.party, type: "customer" })
            .returning({ id: parties.id });
          partyId = created.id;
          partyByName.set(partyKey, partyId);
          createdPartyIds.push(partyId);
        }
      }

      const unitId = row.unitCode
        ? (unitByCode.get(normalizeHeader(row.unitCode)) ?? null)
        : null;

      txValues.push({
        type: row.type ?? defaultType ?? "sale",
        occurredOn: row.date ?? format(new Date(), "yyyy-MM-dd"),
        productId,
        partyId,
        qty: asMoney(row.qty) ?? "1.0000",
        unitId,
        unitPrice: asMoney(row.unitPrice),
        total: asMoney(row.total),
        currency,
        notes: row.notes,
        source: "import",
        importId: id,
      });
    }

    for (let i = 0; i < txValues.length; i += 500) {
      await db.insert(transactions).values(txValues.slice(i, i + 500));
    }

    await db
      .update(imports)
      .set({
        status: "committed",
        mapping: {
          ...(batch.mapping as Record<string, unknown>),
          matches: body.matches,
          createdProductIds,
          createdPartyIds,
          createdCategoryIds,
        },
      })
      .where(eq(imports.id, id));

    await db.insert(auditLog).values({
      actorId: user.id,
      entity: "import",
      entityId: id,
      action: "commit",
      after: {
        transactions: txValues.length,
        createdProducts: createdProductIds.length,
        createdParties: createdPartyIds.length,
        skippedNoProduct,
        skippedByChoice,
      },
    });

    return Response.json({
      transactions: txValues.length,
      createdProducts: createdProductIds.length,
      createdParties: createdPartyIds.length,
      skippedNoProduct,
      skippedByChoice,
    });
  });
}
