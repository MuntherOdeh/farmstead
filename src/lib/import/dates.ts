// Flexible string-date parsing with explicit ambiguity handling (SPEC §5.2):
// "03/04/2026" parses as both D/M and M/D — never guess silently.

export interface FlexibleDateResult {
  /** ISO yyyy-MM-dd, or null when unparseable. */
  iso: string | null;
  /** True when day/month order can't be determined from this value alone. */
  ambiguous: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

/**
 * Parse a string date. `order` resolves X/Y/Z ambiguity (default DMY — the
 * workbook/user locale default per SPEC; the review step confirms it).
 */
export function parseFlexibleDate(
  raw: string,
  order: "DMY" | "MDY" = "DMY",
): FlexibleDateResult {
  const value = raw.trim();

  // ISO: 2026-07-16 (also with / or .)
  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return valid(y, m, d)
      ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false }
      : { iso: null, ambiguous: false };
  }

  // Textual month: 16 Jul 2026 / Jul 16, 2026 / 16-July-2026
  match = value.match(/^(\d{1,2})[\s\-/.]([A-Za-z]{3,9})[\s\-/.,]+(\d{2,4})$/);
  if (match) {
    const m = MONTHS[match[2].toLowerCase()];
    if (m) {
      const d = Number(match[1]);
      const y = expandYear(Number(match[3]));
      return valid(y, m, d)
        ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false }
        : { iso: null, ambiguous: false };
    }
  }
  match = value.match(/^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})[\s\-/.,]+(\d{2,4})$/);
  if (match) {
    const m = MONTHS[match[1].toLowerCase()];
    if (m) {
      const d = Number(match[2]);
      const y = expandYear(Number(match[3]));
      return valid(y, m, d)
        ? { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: false }
        : { iso: null, ambiguous: false };
    }
  }

  // Numeric X/Y/Z — the ambiguous family.
  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const y = expandYear(Number(match[3]));
    const dmyValid = valid(y, b, a); // a=day b=month
    const mdyValid = valid(y, a, b); // a=month b=day
    if (dmyValid && mdyValid && a !== b) {
      // Both readings work → honour the requested order, flag ambiguity.
      const [d, m] = order === "DMY" ? [a, b] : [b, a];
      return { iso: `${y}-${pad(m)}-${pad(d)}`, ambiguous: true };
    }
    if (dmyValid && mdyValid) {
      // a === b (e.g. 3/3/26): same date either way.
      return { iso: `${y}-${pad(b)}-${pad(a)}`, ambiguous: false };
    }
    if (dmyValid) return { iso: `${y}-${pad(b)}-${pad(a)}`, ambiguous: false };
    if (mdyValid) return { iso: `${y}-${pad(a)}-${pad(b)}`, ambiguous: false };
    return { iso: null, ambiguous: false };
  }

  return { iso: null, ambiguous: false };
}

export function isoFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
