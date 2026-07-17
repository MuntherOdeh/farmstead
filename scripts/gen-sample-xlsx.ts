import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

// SPEC §14: two sample workbooks in public/samples — a clean one, and a
// deliberately messy one that the importer must survive. The messy file is
// the actual test.

const OUT_DIR = join(process.cwd(), "public", "samples");

const PRODUCTS = [
  { name: "Wildflower honey 500g", unit: "jar", price: 13 },
  { name: "Citrus honey 500g", unit: "jar", price: 15 },
  { name: "Raw cow milk", unit: "L", price: 1.3 },
  { name: "Raw goat milk", unit: "L", price: 1.9 },
  { name: "Goat cheese 250g", unit: "pcs", price: 8.5 },
  { name: "Awassi lamb (live)", unit: "head", price: 315 },
  { name: "Awassi ewe", unit: "head", price: 280 },
  { name: "Wool fleece", unit: "kg", price: 7 },
  { name: "Free-range eggs", unit: "dozen", price: 4.2 },
  { name: "Sheep labneh 500g", unit: "pcs", price: 6.2 },
];

const CUSTOMERS = [
  "Haddad Butchery",
  "Al-Madina Grocers",
  "Hilltop Dairy Co-op",
  "Saturday Farmers' Market",
  "Cedar Deli",
  "Honey House Boutique",
];

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
const rand = mulberry32(4242);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

function isoDate(row: number): string {
  const month = (row % 6) + 1;
  const day = (row % 27) + 1;
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Clean file ──────────────────────────────────────────────────────────────

function buildClean(): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    ["Date", "Product", "Quantity", "Unit", "Unit Price", "Total", "Customer"],
  ];
  for (let i = 0; i < 120; i++) {
    const product = pick(PRODUCTS);
    const qty = randInt(2, 80);
    const total = Number((qty * product.price).toFixed(2));
    rows.push([
      isoDate(i),
      product.name,
      qty,
      product.unit,
      product.price,
      total,
      pick(CUSTOMERS),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales 2026");
  return wb;
}

// ── Messy file (SPEC §14) ──────────────────────────────────────────────────
// merged title row above the header · mixed date formats · mixed units in one
// column · trailing blanks · an Arabic-header sheet · qty × price ≠ total rows

function buildMessy(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const dateFormats = [
    (i: number) => isoDate(i), // 2026-03-14
    (i: number) => {
      const [y, m, d] = isoDate(i).split("-");
      return `${d}/${m}/${y}`; // 14/03/2026 (some ambiguous)
    },
    (i: number) => {
      const [y, m, d] = isoDate(i).split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      return `${Number(d)} ${months[Number(m) - 1]} ${y}`; // 14 Mar 2026
    },
  ];

  const rows: (string | number | null)[][] = [
    ["مزرعة الوادي الأخضر — Green Valley Farm — Sales Report H1 2026", null, null, null, null, null, null],
    [null, null, null, null, null, null, null],
    ["Sale Date", "Item", "Qty", "unit", "Price per unit", "TOTAL", "Sold To"],
  ];
  for (let i = 0; i < 90; i++) {
    const product = pick(PRODUCTS);
    const qty = randInt(2, 60);
    let total = Number((qty * product.price).toFixed(2));
    // ~7% of rows: the total column is simply wrong (fat-finger).
    if (rand() < 0.07) total = Number((total * (1 + 0.05 + rand() * 0.2)).toFixed(2));
    // mixed units INSIDE one column: kg sometimes written as lb
    const unit = product.unit === "kg" && rand() < 0.35 ? "lb" : product.unit;
    rows.push([
      dateFormats[i % dateFormats.length](i),
      product.name,
      qty,
      unit,
      product.price,
      total,
      pick(CUSTOMERS),
    ]);
  }
  // trailing blank rows + a stray blank column already ensured by nulls
  rows.push([null, null, null, null, null, null, null]);
  rows.push([null, null, null, null, null, null, null]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, ws, "H1 Sales");

  // Arabic-header sheet (SPEC §14)
  const arabicRows: (string | number)[][] = [["التاريخ", "المنتج", "الكمية", "السعر", "الإجمالي", "الزبون"]];
  for (let i = 0; i < 40; i++) {
    const product = pick(PRODUCTS);
    const qty = randInt(2, 40);
    arabicRows.push([
      isoDate(i),
      product.name,
      qty,
      product.price,
      Number((qty * product.price).toFixed(2)),
      pick(CUSTOMERS),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(arabicRows), "مبيعات");

  return wb;
}

mkdirSync(OUT_DIR, { recursive: true });
XLSX.writeFile(buildClean(), join(OUT_DIR, "farmstead-sample-clean.xlsx"));
XLSX.writeFile(buildMessy(), join(OUT_DIR, "farmstead-sample-messy.xlsx"));
console.log("✓ wrote public/samples/farmstead-sample-clean.xlsx and farmstead-sample-messy.xlsx");
