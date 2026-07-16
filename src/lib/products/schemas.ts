import Decimal from "decimal.js";
import { z } from "zod";

// Shared client/server (SPEC §8) — the server re-validates regardless.
// Money travels as strings end-to-end and is only ever parsed by Decimal.

export const decimalString = (opts?: { allowNegative?: boolean }) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .refine((value) => {
      try {
        const d = new Decimal(value);
        return opts?.allowNegative ? d.isFinite() : d.isFinite() && d.gte(0);
      } catch {
        return false;
      }
    }, "Enter a valid number");

export const optionalDecimalString = (opts?: { allowNegative?: boolean }) =>
  z
    .union([z.literal(""), decimalString(opts)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value));

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(200),
  sku: z
    .union([z.literal(""), z.string().trim().max(64)])
    .optional()
    .transform((value) => (value ? value : null)),
  categoryId: z.string().min(1, "Pick a category"),
  unitId: z.string().min(1, "Pick a unit"),
  species: z
    .union([z.literal(""), z.string().trim().max(100)])
    .optional()
    .transform((value) => (value ? value : null)),
  breed: z
    .union([z.literal(""), z.string().trim().max(100)])
    .optional()
    .transform((value) => (value ? value : null)),
  description: z
    .union([z.literal(""), z.string().trim().max(2000)])
    .optional()
    .transform((value) => (value ? value : null)),
  unitPrice: optionalDecimalString(),
  costPrice: optionalDecimalString(),
  stockQty: decimalString({ allowNegative: false }).default("0"),
  reorderLevel: optionalDecimalString(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z
    .union([z.literal(""), z.string().trim().max(2000)])
    .optional()
    .transform((value) => (value ? value : null)),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  delta: decimalString({ allowNegative: true }).refine(
    (value) => !new Decimal(value).isZero(),
    "The adjustment can't be zero",
  ),
  reason: z.string().trim().min(3, "Give a short reason"),
});

export const bulkPriceSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  field: z.enum(["unitPrice", "costPrice"]),
  mode: z.enum(["percent", "absolute"]),
  value: decimalString({ allowNegative: true }),
});

export const bulkCategorySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  categoryId: z.string().min(1),
});

export const bulkArchiveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  archived: z.boolean(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  kind: z
    .enum(["livestock", "dairy", "apiary", "crop", "input", "equipment", "other"])
    .default("other"),
});

export const unitInputSchema = z.object({
  code: z.string().trim().min(1).max(16),
  label: z.string().trim().min(1).max(60),
  dimension: z.enum(["mass", "volume", "count"]).default("count"),
});

export const attributeDefInputSchema = z.object({
  categoryId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "number", "date", "select", "boolean"]).default("text"),
  options: z.array(z.string().trim().min(1)).default([]),
  required: z.boolean().default(false),
});

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
