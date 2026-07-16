// Header/text normalization + fuzzy matching for role detection (SPEC §5.2).

/** lowercase, strip diacritics, collapse spaces/underscores/punctuation. */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // latin diacritics
    .replace(/[ً-ْٰ]/g, "") // arabic harakat
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/[_\-./\\()[\]{}:;,؟?!#*"'%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** True when the normalized strings match exactly or within edit distance 2. */
export function fuzzyEquals(a: string, b: string): boolean {
  if (a === b) return true;
  // Short tokens must match exactly — "no" vs "sold" style false positives.
  if (a.length <= 3 || b.length <= 3) return a === b;
  if (Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= 2;
}
