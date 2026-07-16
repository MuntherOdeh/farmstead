import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Money is numeric(14,4) everywhere — never real/double (SPEC §6, §9).

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const categoryKind = pgEnum("category_kind", [
  "livestock",
  "dairy",
  "apiary",
  "crop",
  "input",
  "equipment",
  "other",
]);

export const unitDimension = pgEnum("unit_dimension", ["mass", "volume", "count"]);

export const attributeType = pgEnum("attribute_type", [
  "text",
  "number",
  "date",
  "select",
  "boolean",
]);

export const partyType = pgEnum("party_type", ["customer", "supplier", "both"]);

export const transactionType = pgEnum("transaction_type", [
  "sale",
  "purchase",
  "birth",
  "death",
  "consumption",
  "adjustment",
  "expense",
]);

export const transactionSource = pgEnum("transaction_source", ["manual", "import"]);

export const importStatus = pgEnum("import_status", [
  "pending",
  "mapping",
  "committing",
  "committed",
  "failed",
  "rolled_back",
]);

export const direction = pgEnum("direction", ["ltr", "rtl"]);

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: categoryKind("kind").notNull().default("other"),
  icon: text("icon"),
  color: text("color"),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: text("created_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const units = pgTable("units", {
  id: id(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  dimension: unitDimension("dimension").notNull(),
  toBaseFactor: numeric("to_base_factor", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  isSystem: boolean("is_system").notNull().default(false),
});

export const attributeDefs = pgTable(
  "attribute_defs",
  {
    id: id(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: attributeType("type").notNull().default("text"),
    options: jsonb("options").$type<string[] | null>(),
    required: boolean("required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("attribute_defs_category_key_idx").on(table.categoryId, table.key)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    sku: text("sku").unique(),
    name: text("name").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id),
    species: text("species"),
    breed: text("breed"),
    description: text("description"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }),
    costPrice: numeric("cost_price", { precision: 14, scale: 4 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    stockQty: numeric("stock_qty", { precision: 14, scale: 4 }).notNull().default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    tags: text("tags").array(),
    imageUrl: text("image_url"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("products_category_idx").on(table.categoryId)],
);

export const parties = pgTable("parties", {
  id: id(),
  name: text("name").notNull(),
  type: partyType("type").notNull().default("customer"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const imports = pgTable(
  "imports",
  {
    id: id(),
    filename: text("filename").notNull(),
    sheetName: text("sheet_name"),
    signature: text("signature").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    status: importStatus("status").notNull().default("pending"),
    mapping: jsonb("mapping"),
    inferredSchema: jsonb("inferred_schema"),
    quality: jsonb("quality"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("imports_signature_idx").on(table.signature)],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: id(),
    importId: text("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    raw: jsonb("raw").notNull(),
    normalized: jsonb("normalized"),
    errors: jsonb("errors"),
  },
  (table) => [
    index("import_rows_import_idx").on(table.importId),
    // Chunk uploads are idempotent: re-sending a chunk must not duplicate rows.
    uniqueIndex("import_rows_import_row_idx").on(table.importId, table.rowIndex),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    type: transactionType("type").notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    partyId: text("party_id").references(() => parties.id),
    qty: numeric("qty", { precision: 14, scale: 4 }).notNull(),
    unitId: text("unit_id").references(() => units.id),
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }),
    total: numeric("total", { precision: 14, scale: 4 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    notes: text("notes"),
    source: transactionSource("source").notNull().default("manual"),
    importId: text("import_id").references(() => imports.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("transactions_occurred_on_idx").on(table.occurredOn),
    index("transactions_product_idx").on(table.productId),
    index("transactions_import_idx").on(table.importId),
  ],
);

export const mappingProfiles = pgTable(
  "mapping_profiles",
  {
    id: id(),
    signature: text("signature").notNull(),
    name: text("name").notNull(),
    mapping: jsonb("mapping").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("mapping_profiles_signature_idx").on(table.signature)],
);

export const dashboards = pgTable(
  "dashboards",
  {
    id: id(),
    name: text("name").notNull(),
    datasetRef: text("dataset_ref").notNull(),
    layout: jsonb("layout").notNull(),
    ownerId: text("owner_id").notNull(),
  },
  (table) => [uniqueIndex("dashboards_dataset_owner_idx").on(table.datasetRef, table.ownerId)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: text("actor_id"),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  locale: text("locale").notNull().default("en-GB"),
  timezone: text("timezone").notNull().default("UTC"),
  defaultWeightUnit: text("default_weight_unit").notNull().default("kg"),
  defaultVolumeUnit: text("default_volume_unit").notNull().default("L"),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  defaultTheme: text("default_theme").notNull().default("default"),
  direction: direction("direction").notNull().default("ltr"),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  attributeDefs: many(attributeDefs),
}));

export const attributeDefsRelations = relations(attributeDefs, ({ one }) => ({
  category: one(categories, {
    fields: [attributeDefs.categoryId],
    references: [categories.id],
  }),
}));

export const unitsRelations = relations(units, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
  transactions: many(transactions),
}));

export const partiesRelations = relations(parties, ({ many }) => ({
  transactions: many(transactions),
}));

export const importsRelations = relations(imports, ({ many }) => ({
  rows: many(importRows),
  transactions: many(transactions),
}));

export const importRowsRelations = relations(importRows, ({ one }) => ({
  import: one(imports, { fields: [importRows.importId], references: [imports.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  product: one(products, {
    fields: [transactions.productId],
    references: [products.id],
  }),
  party: one(parties, { fields: [transactions.partyId], references: [parties.id] }),
  unit: one(units, { fields: [transactions.unitId], references: [units.id] }),
  import: one(imports, { fields: [transactions.importId], references: [imports.id] }),
}));
