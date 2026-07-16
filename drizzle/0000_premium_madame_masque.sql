CREATE TYPE "public"."attribute_type" AS ENUM('text', 'number', 'date', 'select', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('livestock', 'dairy', 'apiary', 'crop', 'input', 'equipment', 'other');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('ltr', 'rtl');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'mapping', 'committing', 'committed', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('customer', 'supplier', 'both');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('sale', 'purchase', 'birth', 'death', 'consumption', 'adjustment', 'expense');--> statement-breakpoint
CREATE TYPE "public"."unit_dimension" AS ENUM('mass', 'volume', 'count');--> statement-breakpoint
CREATE TABLE "attribute_defs" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "attribute_type" DEFAULT 'text' NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "category_kind" DEFAULT 'other' NOT NULL,
	"icon" text,
	"color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dataset_ref" text NOT NULL,
	"layout" jsonb NOT NULL,
	"owner_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"row_index" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb,
	"errors" jsonb
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"sheet_name" text,
	"signature" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"mapping" jsonb,
	"inferred_schema" jsonb,
	"quality" jsonb,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"name" text NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "party_type" DEFAULT 'customer' NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"category_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"species" text,
	"breed" text,
	"description" text,
	"unit_price" numeric(14, 4),
	"cost_price" numeric(14, 4),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"stock_qty" numeric(14, 4) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(14, 4),
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[],
	"image_url" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"locale" text DEFAULT 'en-GB' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"default_weight_unit" text DEFAULT 'kg' NOT NULL,
	"default_volume_unit" text DEFAULT 'L' NOT NULL,
	"fiscal_year_start" integer DEFAULT 1 NOT NULL,
	"default_theme" text DEFAULT 'default' NOT NULL,
	"direction" "direction" DEFAULT 'ltr' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "transaction_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"product_id" text NOT NULL,
	"party_id" text,
	"qty" numeric(14, 4) NOT NULL,
	"unit_id" text,
	"unit_price" numeric(14, 4),
	"total" numeric(14, 4),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"notes" text,
	"source" "transaction_source" DEFAULT 'manual' NOT NULL,
	"import_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"dimension" "unit_dimension" NOT NULL,
	"to_base_factor" numeric(18, 8) DEFAULT '1' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "attribute_defs" ADD CONSTRAINT "attribute_defs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_defs_category_key_idx" ON "attribute_defs" USING btree ("category_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboards_dataset_owner_idx" ON "dashboards" USING btree ("dataset_ref","owner_id");--> statement-breakpoint
CREATE INDEX "import_rows_import_idx" ON "import_rows" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_import_row_idx" ON "import_rows" USING btree ("import_id","row_index");--> statement-breakpoint
CREATE INDEX "imports_signature_idx" ON "imports" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "mapping_profiles_signature_idx" ON "mapping_profiles" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_occurred_on_idx" ON "transactions" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_product_idx" ON "transactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "transactions_import_idx" ON "transactions" USING btree ("import_id");