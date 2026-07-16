import Decimal from "decimal.js";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import type { Db } from "./index";
import {
  attributeDefs,
  auditLog,
  categories,
  dashboards,
  importRows,
  imports,
  mappingProfiles,
  parties,
  products,
  settings,
  transactions,
  units,
} from "./schema";

// Deterministic demo data (SPEC §14): 18 months, ~40 products, ~30 parties,
// ~1,500 transactions with real seasonal shape, plus deliberate anomalies for
// the quality tooling to catch. Deterministic PRNG so reseeding is stable.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260716);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const jitter = (base: number, pct: number) => base * (1 + (rand() * 2 - 1) * pct);

const money = (value: number) => new Decimal(value).toDecimalPlaces(2).toFixed(4);
const qty4 = (value: number) => new Decimal(value).toDecimalPlaces(4).toFixed(4);
const lineTotal = (qty: number, price: number) =>
  new Decimal(qty).mul(new Decimal(price).toDecimalPlaces(2)).toDecimalPlaces(2).toFixed(4);

interface UnitSeed {
  code: string;
  label: string;
  dimension: "mass" | "volume" | "count";
  toBaseFactor: string;
  isSystem: boolean;
}

const UNIT_SEEDS: UnitSeed[] = [
  { code: "head", label: "Head", dimension: "count", toBaseFactor: "1", isSystem: true },
  { code: "kg", label: "Kilogram", dimension: "mass", toBaseFactor: "1", isSystem: true },
  { code: "g", label: "Gram", dimension: "mass", toBaseFactor: "0.001", isSystem: true },
  { code: "ton", label: "Tonne", dimension: "mass", toBaseFactor: "1000", isSystem: true },
  { code: "L", label: "Litre", dimension: "volume", toBaseFactor: "1", isSystem: true },
  { code: "mL", label: "Millilitre", dimension: "volume", toBaseFactor: "0.001", isSystem: true },
  { code: "gal", label: "Gallon (US)", dimension: "volume", toBaseFactor: "3.78541", isSystem: true },
  { code: "dozen", label: "Dozen", dimension: "count", toBaseFactor: "12", isSystem: true },
  { code: "hive", label: "Hive", dimension: "count", toBaseFactor: "1", isSystem: true },
  { code: "bag", label: "Bag", dimension: "count", toBaseFactor: "1", isSystem: true },
  { code: "bale", label: "Bale", dimension: "count", toBaseFactor: "1", isSystem: true },
  { code: "jar", label: "Jar", dimension: "count", toBaseFactor: "1", isSystem: false },
  { code: "pcs", label: "Piece", dimension: "count", toBaseFactor: "1", isSystem: false },
];

interface CategorySeed {
  name: string;
  slug: string;
  kind: "livestock" | "dairy" | "apiary" | "crop" | "input" | "equipment" | "other";
}

const CATEGORY_SEEDS: CategorySeed[] = [
  { name: "Sheep", slug: "sheep", kind: "livestock" },
  { name: "Cows", slug: "cows", kind: "livestock" },
  { name: "Goats", slug: "goats", kind: "livestock" },
  { name: "Bees", slug: "bees", kind: "apiary" },
  { name: "Poultry", slug: "poultry", kind: "livestock" },
  { name: "Milk", slug: "milk", kind: "dairy" },
  { name: "Dairy", slug: "dairy", kind: "dairy" },
  { name: "Honey", slug: "honey", kind: "apiary" },
  { name: "Wool", slug: "wool", kind: "other" },
  { name: "Eggs", slug: "eggs", kind: "other" },
  { name: "Feed", slug: "feed", kind: "input" },
  { name: "Crops", slug: "crops", kind: "crop" },
  { name: "Equipment", slug: "equipment", kind: "equipment" },
  { name: "Other", slug: "other", kind: "other" },
];

interface ProductSeed {
  sku: string;
  name: string;
  category: string; // slug
  unit: string; // code
  species?: string;
  breed?: string;
  unitPrice: number;
  costPrice: number;
  /** Livestock gets a simulated herd ledger; everything else a plain stock figure. */
  herd?: { opening: number; birthable?: boolean };
  stock?: number;
  reorderLevel?: number;
  attributes?: Record<string, unknown>;
}

const PRODUCT_SEEDS: ProductSeed[] = [
  // Livestock — sheep
  { sku: "FS-0001", name: "Awassi ewe", category: "sheep", unit: "head", species: "sheep", breed: "Awassi", unitPrice: 280, costPrice: 195, herd: { opening: 96, birthable: true } },
  { sku: "FS-0002", name: "Awassi ram", category: "sheep", unit: "head", species: "sheep", breed: "Awassi", unitPrice: 430, costPrice: 300, herd: { opening: 7 } },
  { sku: "FS-0003", name: "Awassi lamb (live)", category: "sheep", unit: "head", species: "sheep", breed: "Awassi", unitPrice: 315, costPrice: 205, herd: { opening: 58, birthable: true } },
  { sku: "FS-0004", name: "Naimi lamb (live)", category: "sheep", unit: "head", species: "sheep", breed: "Naimi", unitPrice: 345, costPrice: 235, herd: { opening: 32, birthable: true } },
  // Livestock — cattle
  { sku: "FS-0010", name: "Holstein cow", category: "cows", unit: "head", species: "cattle", breed: "Holstein", unitPrice: 1450, costPrice: 1100, herd: { opening: 28 } },
  { sku: "FS-0011", name: "Holstein heifer", category: "cows", unit: "head", species: "cattle", breed: "Holstein", unitPrice: 1150, costPrice: 860, herd: { opening: 11, birthable: true } },
  { sku: "FS-0012", name: "Holstein calf", category: "cows", unit: "head", species: "cattle", breed: "Holstein", unitPrice: 520, costPrice: 380, herd: { opening: 9, birthable: true } },
  { sku: "FS-0013", name: "Baladi bull", category: "cows", unit: "head", species: "cattle", breed: "Baladi", unitPrice: 1600, costPrice: 1250, herd: { opening: 3 } },
  // Livestock — goats
  { sku: "FS-0020", name: "Damascus doe", category: "goats", unit: "head", species: "goat", breed: "Damascus", unitPrice: 265, costPrice: 180, herd: { opening: 34, birthable: true } },
  { sku: "FS-0021", name: "Damascus buck", category: "goats", unit: "head", species: "goat", breed: "Damascus", unitPrice: 385, costPrice: 270, herd: { opening: 4 } },
  { sku: "FS-0022", name: "Damascus kid", category: "goats", unit: "head", species: "goat", breed: "Damascus", unitPrice: 175, costPrice: 115, herd: { opening: 18, birthable: true } },
  { sku: "FS-0023", name: "Boer goat", category: "goats", unit: "head", species: "goat", breed: "Boer", unitPrice: 310, costPrice: 220, herd: { opening: 12 } },
  // Apiary & poultry stock
  { sku: "FS-0030", name: "Bee hive (nucleus)", category: "bees", unit: "hive", species: "bees", unitPrice: 165, costPrice: 110, herd: { opening: 26 }, attributes: { hive_queen_year: 2025 } },
  { sku: "FS-0031", name: "Production hive with super", category: "bees", unit: "hive", species: "bees", unitPrice: 245, costPrice: 170, herd: { opening: 14 } },
  { sku: "FS-0040", name: "Laying hen", category: "poultry", unit: "head", species: "poultry", unitPrice: 12, costPrice: 8, herd: { opening: 140, birthable: true } },
  { sku: "FS-0041", name: "Rooster", category: "poultry", unit: "head", species: "poultry", unitPrice: 15, costPrice: 9, herd: { opening: 8 } },
  // Milk
  { sku: "FS-0100", name: "Raw cow milk", category: "milk", unit: "L", species: "cattle", unitPrice: 1.3, costPrice: 0.82, stock: 260 },
  { sku: "FS-0101", name: "Raw goat milk", category: "milk", unit: "L", species: "goat", unitPrice: 1.9, costPrice: 1.2, stock: 90 },
  { sku: "FS-0102", name: "Raw sheep milk", category: "milk", unit: "L", species: "sheep", unitPrice: 2.1, costPrice: 1.32, stock: 60 },
  // Dairy
  { sku: "FS-0110", name: "Goat cheese 250g", category: "dairy", unit: "pcs", unitPrice: 8.5, costPrice: 3.8, stock: 210, attributes: { fat_pct: 22 } },
  { sku: "FS-0111", name: "Sheep labneh 500g", category: "dairy", unit: "pcs", unitPrice: 6.2, costPrice: 2.9, stock: 150 },
  { sku: "FS-0112", name: "Cow yoghurt 1L", category: "dairy", unit: "pcs", unitPrice: 3.1, costPrice: 1.4, stock: 180 },
  { sku: "FS-0113", name: "Ghee 1kg", category: "dairy", unit: "jar", unitPrice: 14, costPrice: 8, stock: 45 },
  { sku: "FS-0114", name: "Butter 500g", category: "dairy", unit: "pcs", unitPrice: 5.6, costPrice: 3, stock: 95 },
  // Honey
  { sku: "FS-0120", name: "Wildflower honey 500g", category: "honey", unit: "jar", unitPrice: 13, costPrice: 4.9, stock: 320 },
  { sku: "FS-0121", name: "Citrus honey 500g", category: "honey", unit: "jar", unitPrice: 15, costPrice: 5.6, stock: 190 },
  { sku: "FS-0122", name: "Honeycomb 400g", category: "honey", unit: "pcs", unitPrice: 17.5, costPrice: 7.2, stock: 60 },
  { sku: "FS-0123", name: "Beeswax 1kg", category: "honey", unit: "kg", unitPrice: 11, costPrice: 4.1, stock: 75 },
  // Wool & eggs
  { sku: "FS-0130", name: "Wool fleece", category: "wool", unit: "kg", species: "sheep", unitPrice: 7, costPrice: 4.7, stock: 410 },
  { sku: "FS-0131", name: "Washed wool", category: "wool", unit: "kg", species: "sheep", unitPrice: 11.5, costPrice: 7.8, stock: 130 },
  { sku: "FS-0140", name: "Free-range eggs", category: "eggs", unit: "dozen", species: "poultry", unitPrice: 4.2, costPrice: 2.3, stock: 85 },
  { sku: "FS-0141", name: "Duck eggs", category: "eggs", unit: "dozen", species: "poultry", unitPrice: 6, costPrice: 3.4, stock: 20 },
  // Feed & inputs
  { sku: "FS-0200", name: "Alfalfa bales", category: "feed", unit: "bale", unitPrice: 12, costPrice: 12, stock: 12, reorderLevel: 40 },
  { sku: "FS-0201", name: "Barley feed 50kg", category: "feed", unit: "bag", unitPrice: 23, costPrice: 23, stock: 65, reorderLevel: 30 },
  { sku: "FS-0202", name: "Mineral blocks", category: "feed", unit: "pcs", unitPrice: 9, costPrice: 9, stock: 48, reorderLevel: 20 },
  { sku: "FS-0203", name: "Poultry feed 25kg", category: "feed", unit: "bag", unitPrice: 19, costPrice: 19, stock: 34, reorderLevel: 15 },
  // Crops
  { sku: "FS-0300", name: "Olive oil 1L", category: "crops", unit: "pcs", unitPrice: 12.5, costPrice: 6, stock: 240 },
  { sku: "FS-0301", name: "Alfalfa (grown)", category: "crops", unit: "ton", unitPrice: 85, costPrice: 42, stock: 18 },
  // Equipment
  { sku: "FS-0400", name: "Milking machine", category: "equipment", unit: "pcs", unitPrice: 620, costPrice: 540, stock: 2 },
  { sku: "FS-0401", name: "Shearing blades", category: "equipment", unit: "pcs", unitPrice: 75, costPrice: 60, stock: 6 },
  { sku: "FS-0402", name: "Bee smoker", category: "equipment", unit: "pcs", unitPrice: 28, costPrice: 20, stock: 9 },
  // Services (ledger-only "products" so expense rows keep a strict FK)
  { sku: "FS-0900", name: "Veterinary services", category: "other", unit: "pcs", unitPrice: 0, costPrice: 0, stock: 0 },
  { sku: "FS-0901", name: "Transport & haulage", category: "other", unit: "pcs", unitPrice: 0, costPrice: 0, stock: 0 },
  { sku: "FS-0902", name: "Seasonal labour", category: "other", unit: "pcs", unitPrice: 0, costPrice: 0, stock: 0 },
];

const CUSTOMERS = [
  "Haddad Butchery",
  "Al-Madina Grocers",
  "Hilltop Dairy Co-op",
  "Saturday Farmers' Market",
  "Golden Spoon Restaurant",
  "Petra Foods Ltd",
  "Nour Sweets",
  "Cedar Deli",
  "Oasis Hotel Kitchen",
  "Village Bakery",
  "Al-Rabee Supermarket",
  "Green Basket Organics",
  "Sunrise Café",
  "Layla Haddad (household)",
  "Abu Khalil (household)",
  "Textile Traders Ltd",
  "Wool & Weave Studio",
  "City Egg Distributors",
  "Honey House Boutique",
  "Twin Palms Catering",
];

const SUPPLIERS = [
  "Green Valley Feeds",
  "AgriVet Supplies",
  "Dr. Nasser Veterinary Clinic",
  "Jordan Valley Hatchery",
  "Hive & Harvest Equipment",
  "Wadi Seed Co.",
  "Mountain Water Tankers",
  "Barakah Hardware",
  "Al-Ameen Transport",
];

const BOTH_PARTIES = ["Bedouin Livestock Traders"];

interface AttributeDefSeed {
  category: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
}

const ATTRIBUTE_DEF_SEEDS: AttributeDefSeed[] = [
  { category: "sheep", key: "ear_tag", label: "Ear tag", type: "text" },
  { category: "sheep", key: "sex", label: "Sex", type: "select", options: ["ewe", "ram"] },
  { category: "sheep", key: "vaccination_date", label: "Vaccination date", type: "date" },
  { category: "cows", key: "ear_tag", label: "Ear tag", type: "text" },
  { category: "cows", key: "milking", label: "In milking rotation", type: "boolean" },
  { category: "goats", key: "ear_tag", label: "Ear tag", type: "text" },
  { category: "bees", key: "hive_queen_year", label: "Queen year", type: "number" },
  { category: "milk", key: "fat_pct", label: "Milk fat %", type: "number" },
  { category: "dairy", key: "fat_pct", label: "Fat %", type: "number" },
];

type TxInsert = typeof transactions.$inferInsert;

interface SeedSummary {
  products: number;
  parties: number;
  transactions: number;
  months: number;
  herdClosing: Record<string, number>;
}

/** Wipe app data (auth tables untouched) and regenerate the full demo set. */
export async function seedDatabase(db: Db, today = new Date()): Promise<SeedSummary> {
  // Delete in FK dependency order.
  await db.delete(transactions);
  await db.delete(importRows);
  await db.delete(imports);
  await db.delete(mappingProfiles);
  await db.delete(dashboards);
  await db.delete(auditLog);
  await db.delete(products);
  await db.delete(attributeDefs);
  await db.delete(parties);
  await db.delete(categories);
  await db.delete(units);
  await db.delete(settings);

  await db.insert(settings).values({
    id: "singleton",
    currency: "USD",
    locale: "en-GB",
    timezone: "UTC",
    defaultWeightUnit: "kg",
    defaultVolumeUnit: "L",
    fiscalYearStart: 1,
    defaultTheme: "default",
    direction: "ltr",
  });

  const unitRows = await db.insert(units).values(UNIT_SEEDS).returning();
  const unitId = new Map(unitRows.map((u) => [u.code, u.id]));

  const categoryRows = await db
    .insert(categories)
    .values(CATEGORY_SEEDS.map((c) => ({ ...c, isSystem: true })))
    .returning();
  const categoryId = new Map(categoryRows.map((c) => [c.slug, c.id]));

  await db.insert(attributeDefs).values(
    ATTRIBUTE_DEF_SEEDS.map((def, i) => ({
      categoryId: categoryId.get(def.category)!,
      key: def.key,
      label: def.label,
      type: def.type,
      options: def.options ?? null,
      sortOrder: i,
    })),
  );

  const partyRows = await db
    .insert(parties)
    .values([
      ...CUSTOMERS.map((name) => ({ name, type: "customer" as const })),
      ...SUPPLIERS.map((name) => ({ name, type: "supplier" as const })),
      ...BOTH_PARTIES.map((name) => ({ name, type: "both" as const })),
    ])
    .returning();
  const customers = partyRows.filter((p) => p.type !== "supplier");
  const suppliers = partyRows.filter((p) => p.type !== "customer");
  const partyByName = new Map(partyRows.map((p) => [p.name, p]));

  // Livestock herd ledgers — the reconciliation in SPEC §9 must balance, so
  // stock_qty is *derived* from the generated events, never invented.
  const herd = new Map<string, { qty: number; opening: number }>();
  for (const seed of PRODUCT_SEEDS) {
    if (seed.herd) herd.set(seed.sku, { qty: seed.herd.opening, opening: seed.herd.opening });
  }

  const productRows = await db
    .insert(products)
    .values(
      PRODUCT_SEEDS.map((seed) => ({
        sku: seed.sku,
        name: seed.name,
        categoryId: categoryId.get(seed.category)!,
        unitId: unitId.get(seed.unit)!,
        species: seed.species,
        breed: seed.breed,
        unitPrice: money(seed.unitPrice),
        costPrice: money(seed.costPrice),
        currency: "USD",
        stockQty: qty4(seed.herd ? seed.herd.opening : (seed.stock ?? 0)),
        reorderLevel: seed.reorderLevel !== undefined ? qty4(seed.reorderLevel) : null,
        attributes: seed.attributes ?? {},
      })),
    )
    .returning();
  const productBySku = new Map(productRows.map((p) => [p.sku!, p]));
  const seedBySku = new Map(PRODUCT_SEEDS.map((s) => [s.sku, s]));

  const txRows: TxInsert[] = [];
  const monthCount = 18;

  const dayIn = (monthStart: Date) => {
    const day = addDays(monthStart, randInt(0, 27));
    // Never date a row in the future — clamp the current month to today.
    return format(day > today ? today : day, "yyyy-MM-dd");
  };

  const pushTx = (tx: Omit<TxInsert, "currency" | "source">) => {
    txRows.push({ ...tx, currency: "USD", source: "manual" });
  };

  const sale = (sku: string, date: string, qty: number, priceMul = 1, note?: string) => {
    const seed = seedBySku.get(sku)!;
    const product = productBySku.get(sku)!;
    const price = new Decimal(jitter(seed.unitPrice * priceMul, 0.06)).toDecimalPlaces(2);
    pushTx({
      type: "sale",
      occurredOn: date,
      productId: product.id,
      partyId: pick(customers).id,
      qty: qty4(qty),
      unitId: product.unitId,
      unitPrice: price.toFixed(4),
      total: lineTotal(qty, price.toNumber()),
      notes: note,
    });
  };

  const herdEvent = (
    sku: string,
    type: "birth" | "death" | "purchase" | "sale" | "consumption",
    date: string,
    qty: number,
    note?: string,
  ) => {
    const ledger = herd.get(sku)!;
    if ((type === "sale" || type === "death" || type === "consumption") && ledger.qty < qty) {
      return; // never let the herd go negative
    }
    ledger.qty += type === "birth" || type === "purchase" ? qty : -qty;

    const seed = seedBySku.get(sku)!;
    const product = productBySku.get(sku)!;
    if (type === "sale") {
      sale(sku, date, qty, 1, note);
      return;
    }
    const isPurchase = type === "purchase";
    const price = isPurchase
      ? new Decimal(jitter(seed.costPrice, 0.05)).toDecimalPlaces(2)
      : null;
    pushTx({
      type,
      occurredOn: date,
      productId: product.id,
      partyId: isPurchase ? partyByName.get("Bedouin Livestock Traders")!.id : null,
      qty: qty4(qty),
      unitId: product.unitId,
      unitPrice: price ? price.toFixed(4) : null,
      total: price ? lineTotal(qty, price.toNumber()) : null,
      notes: note,
    });
  };

  const expense = (sku: string, date: string, amount: number, note: string) => {
    const product = productBySku.get(sku)!;
    const supplier =
      sku === "FS-0900"
        ? partyByName.get("Dr. Nasser Veterinary Clinic")!
        : sku === "FS-0901"
          ? partyByName.get("Al-Ameen Transport")!
          : pick(suppliers);
    pushTx({
      type: "expense",
      occurredOn: date,
      productId: product.id,
      partyId: supplier.id,
      qty: "1.0000",
      unitId: product.unitId,
      unitPrice: money(amount),
      total: money(amount),
      notes: note,
    });
  };

  const feedPurchase = (sku: string, date: string, qty: number) => {
    const seed = seedBySku.get(sku)!;
    const product = productBySku.get(sku)!;
    const price = new Decimal(jitter(seed.costPrice, 0.04)).toDecimalPlaces(2);
    pushTx({
      type: "purchase",
      occurredOn: date,
      productId: product.id,
      partyId: partyByName.get("Green Valley Feeds")!.id,
      qty: qty4(qty),
      unitId: product.unitId,
      unitPrice: price.toFixed(4),
      total: lineTotal(qty, price.toNumber()),
    });
  };

  for (let m = 0; m < monthCount; m++) {
    const monthStart = startOfMonth(subMonths(today, monthCount - 1 - m));
    const month = monthStart.getMonth() + 1; // 1–12
    const year = monthStart.getFullYear();
    // Eid al-Adha demand spike: Jun 2025, May–Jun 2026.
    const eid = (year === 2025 && month === 6) || (year === 2026 && (month === 5 || month === 6));
    const spring = month >= 1 && month <= 4;
    const honeySeason = month === 8 || month === 9;
    // Milk yield dips in winter.
    const milkFactor = month === 12 || month === 1 || month === 2 ? 0.72 : 1;

    // Milk pickups roughly every other day.
    for (let i = 0; i < 15; i++) {
      sale("FS-0100", dayIn(monthStart), Math.round(jitter(420, 0.18) * milkFactor));
      if (rand() < 0.6) sale("FS-0101", dayIn(monthStart), Math.round(jitter(95, 0.25) * milkFactor));
      if (rand() < 0.4) sale("FS-0102", dayIn(monthStart), Math.round(jitter(55, 0.3) * milkFactor));
    }
    // Dairy products several times a week.
    for (let i = 0; i < 16; i++) {
      sale(pick(["FS-0110", "FS-0111", "FS-0112", "FS-0113", "FS-0114"]), dayIn(monthStart), randInt(12, 90));
    }
    // Eggs twice a week.
    for (let i = 0; i < 10; i++) {
      sale("FS-0140", dayIn(monthStart), randInt(20, 55));
      if (rand() < 0.35) sale("FS-0141", dayIn(monthStart), randInt(4, 14));
    }
    // Honey: heavy at harvest, trickle otherwise.
    const honeyRows = honeySeason ? 9 : randInt(3, 4);
    for (let i = 0; i < honeyRows; i++) {
      sale(pick(["FS-0120", "FS-0121", "FS-0122", "FS-0123"]), dayIn(monthStart), randInt(15, 120));
    }
    // Wool at spring shearing.
    if (month >= 3 && month <= 5) {
      for (let i = 0; i < randInt(2, 4); i++) {
        sale(pick(["FS-0130", "FS-0131"]), dayIn(monthStart), randInt(60, 260));
      }
    }
    // Olive oil after autumn press.
    if (month === 11 || month === 12) {
      for (let i = 0; i < randInt(2, 4); i++) sale("FS-0300", dayIn(monthStart), randInt(20, 80));
    }

    // Livestock sales (Eid spike).
    const lambSales = eid ? randInt(6, 9) : randInt(2, 4);
    for (let i = 0; i < lambSales; i++) {
      herdEvent(rand() < 0.72 ? "FS-0003" : "FS-0004", "sale", dayIn(monthStart), randInt(2, eid ? 12 : 5));
    }
    if (rand() < 0.5) herdEvent("FS-0001", "sale", dayIn(monthStart), randInt(1, 4));
    if (rand() < 0.35) herdEvent(pick(["FS-0020", "FS-0022", "FS-0023"]), "sale", dayIn(monthStart), randInt(1, 5));
    if (rand() < 0.3) herdEvent(pick(["FS-0010", "FS-0011", "FS-0012"]), "sale", dayIn(monthStart), randInt(1, 2));
    if (rand() < 0.2) herdEvent(pick(["FS-0030", "FS-0031"]), "sale", dayIn(monthStart), randInt(1, 3));
    if (rand() < 0.25) herdEvent("FS-0040", "sale", dayIn(monthStart), randInt(5, 20));

    // Births in spring (lambing/kidding/calving), hens year-round.
    if (spring) {
      herdEvent("FS-0003", "birth", dayIn(monthStart), randInt(10, 20), "Lambing");
      herdEvent("FS-0004", "birth", dayIn(monthStart), randInt(4, 9), "Lambing");
      herdEvent("FS-0022", "birth", dayIn(monthStart), randInt(3, 8), "Kidding");
      if (rand() < 0.6) herdEvent("FS-0012", "birth", dayIn(monthStart), randInt(1, 3), "Calving");
    }
    if (rand() < 0.4) herdEvent("FS-0040", "birth", dayIn(monthStart), randInt(4, 12), "Hatched");

    // Occasional deaths and home consumption.
    if (rand() < 0.45) {
      herdEvent(
        pick(["FS-0003", "FS-0004", "FS-0022", "FS-0040", "FS-0012"]),
        "death",
        dayIn(monthStart),
        randInt(1, 2),
        "Recorded loss",
      );
    }
    if (rand() < 0.3) {
      herdEvent(pick(["FS-0003", "FS-0040"]), "consumption", dayIn(monthStart), 1, "Farm use");
    }

    // Restocking purchases.
    if (rand() < 0.4) herdEvent(pick(["FS-0001", "FS-0020", "FS-0011"]), "purchase", dayIn(monthStart), randInt(2, 6), "Restock");
    if (month === 3 && rand() < 0.7) herdEvent("FS-0030", "purchase", dayIn(monthStart), randInt(2, 4), "New nucleus colonies");

    // Feed purchases + a consumption drawdown, plus expenses.
    feedPurchase("FS-0200", dayIn(monthStart), randInt(60, 140));
    feedPurchase(pick(["FS-0201", "FS-0202", "FS-0203"]), dayIn(monthStart), randInt(15, 45));
    {
      const feed = productBySku.get("FS-0200")!;
      pushTx({
        type: "consumption",
        occurredOn: dayIn(monthStart),
        productId: feed.id,
        partyId: null,
        qty: qty4(randInt(55, 130)),
        unitId: feed.unitId,
        unitPrice: null,
        total: null,
        notes: "Fed out",
      });
    }
    expense("FS-0900", dayIn(monthStart), jitter(340, 0.35), "Routine visits & medicine");
    if (rand() < 0.7) expense("FS-0901", dayIn(monthStart), jitter(160, 0.4), "Market runs");
    if (spring || honeySeason) expense("FS-0902", dayIn(monthStart), jitter(420, 0.3), "Seasonal labour");
  }

  // ── Deliberate anomalies for the quality tooling (SPEC §14) ──────────────
  const saleIndexes = txRows
    .map((tx, i) => ({ tx, i }))
    .filter(({ tx }) => tx.type === "sale" && tx.total !== null);
  for (let k = 0; k < 3; k++) {
    const { tx } = saleIndexes[Math.floor(rand() * saleIndexes.length)];
    tx.total = new Decimal(tx.total!).mul(1 + (0.03 + rand() * 0.05)).toDecimalPlaces(2).toFixed(4);
    tx.notes = "entry error (demo anomaly: total ≠ qty × price)";
  }
  {
    // Honey priced 22% above list — the "unusual price" alert.
    const honey = productBySku.get("FS-0120")!;
    const price = new Decimal(seedBySku.get("FS-0120")!.unitPrice).mul(1.22).toDecimalPlaces(2);
    pushTx({
      type: "sale",
      occurredOn: format(subMonths(today, 0), "yyyy-MM-dd"),
      productId: honey.id,
      partyId: partyByName.get("Honey House Boutique")!.id,
      qty: "36.0000",
      unitId: honey.unitId,
      unitPrice: price.toFixed(4),
      total: lineTotal(36, price.toNumber()),
      notes: "priced 22% above list (demo anomaly)",
    });
  }
  {
    // One exact duplicate row.
    const original = saleIndexes[Math.floor(rand() * saleIndexes.length)].tx;
    txRows.push({ ...original, notes: "duplicate entry (demo anomaly)" });
  }

  for (let i = 0; i < txRows.length; i += 500) {
    await db.insert(transactions).values(txRows.slice(i, i + 500));
  }

  // Persist closing herd counts so reconciliation balances by construction.
  const herdClosing: Record<string, number> = {};
  for (const [sku, ledger] of herd) {
    herdClosing[sku] = ledger.qty;
    const { eq } = await import("drizzle-orm");
    await db
      .update(products)
      .set({ stockQty: qty4(ledger.qty) })
      .where(eq(products.sku, sku));
  }

  return {
    products: productRows.length,
    parties: partyRows.length,
    transactions: txRows.length,
    months: monthCount,
    herdClosing,
  };
}
