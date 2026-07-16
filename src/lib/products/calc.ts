import Decimal from "decimal.js";

// Display-side product maths (SPEC §9) — Decimal only, round at display.

function parse(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export interface ProductCalc {
  margin: string | null;
  marginPct: string | null;
  markupPct: string | null;
  stockValue: string | null;
}

export function productCalc(input: {
  unitPrice: string | null | undefined;
  costPrice: string | null | undefined;
  stockQty: string | null | undefined;
}): ProductCalc {
  const price = parse(input.unitPrice);
  const cost = parse(input.costPrice);
  const qty = parse(input.stockQty);

  const margin = price && cost ? price.minus(cost) : null;
  const marginPct =
    margin && price && !price.isZero() ? margin.div(price).mul(100) : null;
  const markupPct = margin && cost && !cost.isZero() ? margin.div(cost).mul(100) : null;
  const stockValue = qty && cost ? qty.mul(cost) : null;

  return {
    margin: margin ? margin.toDecimalPlaces(2).toString() : null,
    marginPct: marginPct ? marginPct.toDecimalPlaces(1).toString() : null,
    markupPct: markupPct ? markupPct.toDecimalPlaces(1).toString() : null,
    stockValue: stockValue ? stockValue.toDecimalPlaces(2).toString() : null,
  };
}
