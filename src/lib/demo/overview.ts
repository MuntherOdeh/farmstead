// DEMO FIXTURES for Milestone 1 — hand-written, deliberately seasonal-looking
// numbers so the shell is screenshot-able before the database exists. Replaced
// by real queries + the seed script in Milestone 2 (SPEC §14).

export interface MonthPoint {
  month: string;
  revenue: number;
  costs: number;
}

/** 18 months, Jan 2025 – Jun 2026. Spikes: Eid (Jun 25 / May 26), honey harvest (Aug–Sep). */
export const revenueSeries: MonthPoint[] = [
  { month: "Jan 25", revenue: 29400, costs: 19100 },
  { month: "Feb 25", revenue: 31200, costs: 19800 },
  { month: "Mar 25", revenue: 38900, costs: 22400 },
  { month: "Apr 25", revenue: 41200, costs: 23100 },
  { month: "May 25", revenue: 44800, costs: 24600 },
  { month: "Jun 25", revenue: 52600, costs: 26900 },
  { month: "Jul 25", revenue: 36100, costs: 21800 },
  { month: "Aug 25", revenue: 42300, costs: 22900 },
  { month: "Sep 25", revenue: 40100, costs: 22300 },
  { month: "Oct 25", revenue: 35800, costs: 21600 },
  { month: "Nov 25", revenue: 33400, costs: 20900 },
  { month: "Dec 25", revenue: 36700, costs: 21500 },
  { month: "Jan 26", revenue: 32100, costs: 20400 },
  { month: "Feb 26", revenue: 34600, costs: 21100 },
  { month: "Mar 26", revenue: 42800, costs: 23800 },
  { month: "Apr 26", revenue: 45300, costs: 24700 },
  { month: "May 26", revenue: 49700, costs: 26200 },
  { month: "Jun 26", revenue: 46900, costs: 25400 },
];

export interface KpiFixture {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
}

export const kpis: KpiFixture[] = [
  { label: "Revenue · June", value: "$46,900", delta: -5.6, deltaLabel: "vs May" },
  { label: "Gross margin", value: "45.8%", delta: 1.2, deltaLabel: "vs May" },
  { label: "Head count", value: "486", delta: 2.5, deltaLabel: "12 born, 4 sold" },
  { label: "Stock value", value: "$210,540", delta: 3.4, deltaLabel: "vs May" },
];

export interface CategorySlice {
  key: string;
  label: string;
  revenue: number;
}

/** Trailing-12-month revenue mix. Keys map to chart config entries. */
export const categoryMix: CategorySlice[] = [
  { key: "sheep", label: "Sheep", revenue: 168400 },
  { key: "dairy", label: "Dairy", revenue: 121300 },
  { key: "cattle", label: "Cattle", revenue: 89200 },
  { key: "honey", label: "Honey", revenue: 54800 },
  { key: "wool", label: "Wool", revenue: 28600 },
];

export interface TopProduct {
  name: string;
  revenue: number;
  marginPct: number;
}

export const topProducts: TopProduct[] = [
  { name: "Awassi lamb (live)", revenue: 96200, marginPct: 41 },
  { name: "Raw cow milk", revenue: 58900, marginPct: 38 },
  { name: "Wildflower honey 500g", revenue: 34100, marginPct: 62 },
  { name: "Holstein heifer", revenue: 28800, marginPct: 27 },
  { name: "Goat cheese 250g", revenue: 21400, marginPct: 55 },
  { name: "Wool fleece", revenue: 9800, marginPct: 33 },
];

export type TransactionType = "sale" | "purchase" | "birth" | "expense";

export interface RecentTransaction {
  date: string;
  type: TransactionType;
  product: string;
  party: string;
  qty: string;
  total: string;
}

export const recentTransactions: RecentTransaction[] = [
  { date: "15 Jul", type: "sale", product: "Wildflower honey 500g", party: "Al-Madina Grocers", qty: "48 jar", total: "$624.00" },
  { date: "15 Jul", type: "sale", product: "Raw cow milk", party: "Hilltop Dairy Co-op", qty: "620 L", total: "$806.00" },
  { date: "14 Jul", type: "sale", product: "Awassi lamb (live)", party: "Haddad Butchery", qty: "6 head", total: "$1,890.00" },
  { date: "13 Jul", type: "purchase", product: "Alfalfa feed bales", party: "Green Valley Feeds", qty: "120 bale", total: "$1,440.00" },
  { date: "12 Jul", type: "sale", product: "Goat cheese 250g", party: "Farmers' market", qty: "85 pcs", total: "$722.50" },
  { date: "11 Jul", type: "birth", product: "Awassi lamb", party: "—", qty: "4 head", total: "—" },
  { date: "10 Jul", type: "sale", product: "Wool fleece", party: "Textile Traders Ltd", qty: "210 kg", total: "$1,470.00" },
  { date: "9 Jul", type: "expense", product: "Veterinary services", party: "Dr. Nasser Clinic", qty: "—", total: "$380.00" },
];

export interface AlertFixture {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

export const alerts: AlertFixture[] = [
  {
    severity: "critical",
    title: "Low stock — alfalfa feed",
    detail: "12 bales left, reorder level is 40.",
  },
  {
    severity: "warning",
    title: "Milk yield anomaly",
    detail: "This week is 18% below the seasonal average.",
  },
  {
    severity: "info",
    title: "Price check — honey",
    detail: "Last import priced 22% above your list price.",
  },
];
