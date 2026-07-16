// Display formatting only — money maths happens in Decimal (SPEC §9), never here.
// Locale/currency come from Settings once the database milestone lands; until
// then these are the §0 defaults.

const LOCALE = "en-GB";
const CURRENCY = "USD";

const money = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat(LOCALE);

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatMoneyExact(value: number): string {
  return moneyExact.format(value);
}

export function formatMoneyCompact(value: number): string {
  return moneyCompact.format(value);
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatDeltaPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
