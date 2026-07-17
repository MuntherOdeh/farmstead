import { z } from "zod";

// Wire formats for the import API routes. The client parses the workbook
// (SPEC §5.1 — Vercel's 4.5 MB body cap) and POSTs normalized JSON in chunks.

export const columnMappingSchema = z.object({
  index: z.number().int().min(0),
  header: z.string(),
  include: z.boolean(),
  type: z.string(),
  role: z.string(),
  unitCode: z.string().nullable(),
  dateOrder: z.enum(["DMY", "MDY"]),
});

export const importMappingSchema = z.object({
  columns: z.array(columnMappingSchema).min(1),
  currency: z.string().length(3),
  authoritativeAmount: z.enum(["total", "unit_price"]),
  defaultTransactionType: z.enum([
    "sale",
    "purchase",
    "birth",
    "death",
    "consumption",
    "adjustment",
    "expense",
  ]),
});

export const createImportSchema = z.object({
  filename: z.string().min(1).max(300),
  sheetName: z.string().max(120).nullable(),
  signature: z.string().length(64),
  rowCount: z.number().int().min(0),
  mapping: importMappingSchema,
  inferredSchema: z.unknown(),
  quality: z.unknown(),
});

export const normalizedRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  date: z.string().nullable(),
  productName: z.string().nullable(),
  qty: z.string().nullable(),
  unitCode: z.string().nullable(),
  unitPrice: z.string().nullable(),
  total: z.string().nullable(),
  party: z.string().nullable(),
  type: z
    .enum(["sale", "purchase", "birth", "death", "consumption", "adjustment", "expense"])
    .nullable(),
  notes: z.string().nullable(),
  extras: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  problems: z.array(z.string()),
});

export const chunkSchema = z.object({
  chunkIndex: z.number().int().min(0),
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int().min(0),
        raw: z.record(z.string(), z.unknown()),
        normalized: normalizedRowSchema,
      }),
    )
    .min(1)
    .max(2500),
});

export const matchRequestSchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(2000),
});

export const productMatchSchema = z.object({
  name: z.string().min(1),
  action: z.enum(["map", "create", "skip"]),
  productId: z.string().nullable(),
  categoryId: z.string().nullable(),
});

export const commitSchema = z.object({
  matches: z.array(productMatchSchema),
  /** Keep the dataset (rows + dashboard) but create NO ledger transactions —
   *  for summary/reference sheets that aren't transactional data. */
  referenceOnly: z.boolean().optional().default(false),
});

export const saveProfileSchema = z.object({
  signature: z.string().length(64),
  name: z.string().min(1).max(120),
  mapping: importMappingSchema,
});

export type ImportMappingWire = z.infer<typeof importMappingSchema>;
export type NormalizedRowWire = z.infer<typeof normalizedRowSchema>;
export type ProductMatchWire = z.infer<typeof productMatchSchema>;
