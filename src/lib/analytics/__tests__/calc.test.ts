import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  herdReconciliation,
  monthlyTrend,
  mortalityRate,
  naiveForecast,
  profitBy,
  profitSummary,
  stockValuation,
  type LedgerRow,
  type ProductSnapshot,
} from "../calc";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    type: "sale",
    occurredOn: "2026-01-10",
    productId: "p1",
    productName: "Honey",
    categorySlug: "honey",
    categoryName: "Honey",
    species: null,
    unitCode: "jar",
    qty: "1",
    unitPrice: null,
    total: null,
    costPrice: null,
    partyId: null,
    partyName: null,
    ...partial,
  };
}

describe("profitSummary", () => {
  it("computes revenue, cogs, margin and percentages exactly", () => {
    const rows: LedgerRow[] = [
      row({ total: "100.00", qty: "10", costPrice: "4.00" }), // cogs 40
      row({ total: "50.00", qty: "5", costPrice: "4.00" }), // cogs 20
      row({ type: "expense", total: "30.00" }),
      row({ type: "purchase", total: "999.00" }), // ignored in revenue
    ];
    const s = profitSummary(rows);
    expect(s.revenue.toFixed(2)).toBe("150.00");
    expect(s.cogs.toFixed(2)).toBe("60.00");
    expect(s.grossMargin.toFixed(2)).toBe("90.00");
    expect(s.marginPct!.toFixed(2)).toBe("60.00");
    expect(s.markupPct!.toFixed(2)).toBe("150.00");
    expect(s.expenses.toFixed(2)).toBe("30.00");
  });
});

describe("profitBy", () => {
  it("groups by key, ranks by revenue, computes margins", () => {
    const rows: LedgerRow[] = [
      row({ productId: "a", productName: "A", total: "10", qty: "1", costPrice: "5" }),
      row({ productId: "a", productName: "A", total: "20", qty: "2", costPrice: "5" }),
      row({ productId: "b", productName: "B", total: "100", qty: "1", costPrice: "80" }),
    ];
    const grouped = profitBy(rows, (r) => ({ key: r.productId, label: r.productName }));
    expect(grouped[0].key).toBe("b");
    expect(grouped[0].profit.toFixed(2)).toBe("20.00");
    expect(grouped[1].key).toBe("a");
    expect(grouped[1].revenue.toFixed(2)).toBe("30.00");
    expect(grouped[1].cogs.toFixed(2)).toBe("15.00");
    expect(grouped[1].marginPct!.toFixed(2)).toBe("50.00");
  });
});

describe("herdReconciliation", () => {
  const products: ProductSnapshot[] = [
    {
      id: "ewe",
      name: "Ewe",
      sku: null,
      categorySlug: "sheep",
      categoryName: "Sheep",
      species: "sheep",
      unitCode: "head",
      stockQty: "87",
      costPrice: "195",
      unitPrice: "280",
      reorderLevel: null,
    },
  ];
  const ledger: LedgerRow[] = [
    row({ productId: "ewe", type: "purchase", qty: "18" }),
    row({ productId: "ewe", type: "sale", qty: "27", total: "7560", costPrice: "195" }),
    // opening must be 87 - (18 - 27) = 96
  ];

  it("derives opening from the identity and balances", () => {
    const [recon] = herdReconciliation(ledger, products);
    expect(recon.opening.toNumber()).toBe(96);
    expect(recon.purchases.toNumber()).toBe(18);
    expect(recon.sales.toNumber()).toBe(27);
    expect(recon.expectedClosing.toNumber()).toBe(87);
    expect(recon.actualClosing.toNumber()).toBe(87);
    expect(recon.balances).toBe(true);
  });

  it("flags a negative implied opening as a discrepancy", () => {
    const bad: LedgerRow[] = [row({ productId: "ewe", type: "birth", qty: "200" })];
    const [recon] = herdReconciliation(bad, products);
    expect(recon.opening.toNumber()).toBe(-113);
    expect(recon.balances).toBe(false);
  });

  it("computes mortality against the average herd", () => {
    const withDeaths: LedgerRow[] = [
      ...ledger,
      row({ productId: "ewe", type: "death", qty: "3" }),
    ];
    const recon = herdReconciliation(withDeaths, products);
    // opening = 87 - (18 - 27 - 3) = 99; average = (99 + 87)/2 = 93
    const rate = mortalityRate(recon);
    expect(rate!.toFixed(2)).toBe(new Decimal(3).div(93).mul(100).toFixed(2));
  });
});

describe("stockValuation", () => {
  it("sums qty × cost", () => {
    const products: ProductSnapshot[] = [
      { id: "1", name: "A", sku: null, categorySlug: "x", categoryName: "X", species: null, unitCode: "kg", stockQty: "10", costPrice: "2.50", unitPrice: null, reorderLevel: null },
      { id: "2", name: "B", sku: null, categorySlug: "x", categoryName: "X", species: null, unitCode: "kg", stockQty: "4", costPrice: null, unitPrice: null, reorderLevel: null },
    ];
    expect(stockValuation(products).toFixed(2)).toBe("25.00");
  });
});

describe("monthlyTrend + forecast", () => {
  const rows: LedgerRow[] = [
    row({ occurredOn: "2026-01-05", total: "100" }),
    row({ occurredOn: "2026-02-05", total: "200" }),
    row({ occurredOn: "2026-03-05", total: "300" }),
    row({ occurredOn: "2026-04-05", total: "600" }),
  ];
  const trend = monthlyTrend(rows, (r) => (r.type === "sale" ? new Decimal(r.total ?? 0) : null));

  it("orders months, computes MoM and 3-month moving average", () => {
    expect(trend.map((t) => t.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(trend[1].momPct!.toFixed(0)).toBe("100");
    expect(trend[2].ma3!.toFixed(2)).toBe("200.00");
    expect(trend[3].ma3!.toFixed(2)).toBe(new Decimal(200 + 300 + 600).div(3).toFixed(2));
  });

  it("naive forecast = mean of the last three months", () => {
    expect(naiveForecast(trend)!.toFixed(2)).toBe(new Decimal(200 + 300 + 600).div(3).toFixed(2));
  });
});
