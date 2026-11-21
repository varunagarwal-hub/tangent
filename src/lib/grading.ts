/**
 * Deterministic answer matching. Used for instant grading (<200ms, no AI) and by
 * the verifier to compare its independent answer with the key.
 */

/** Strip LaTeX wrappers, currency, units, commas and spaces; lowercase. */
export function normalizeAnswer(s: string): string {
  return s
    .replace(/\$/g, "")
    .replace(/\\(text|mathrm)\{([^}]*)\}/g, "$2")
    .replace(/\\%/g, "%")
    .replace(/₹|rs\.?|inr/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Parse "3/4", "\frac{3}{4}", "14.4", "-4%", "2,000" → number. */
export function toNumber(s: string): number | null {
  const n = normalizeAnswer(s)
    .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/%$/, "")
    .replace(/(km\/h|kmph|km|m\/s|days?|hours?|hrs?|litres?|l|sq\.?cm|cm|m|units?)$/, "");
  if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
  const frac = n.match(/^\(?(-?\d+(?:\.\d+)?)\)?\/\(?(-?\d+(?:\.\d+)?)\)?$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

export function answersMatch(a: string, b: string): boolean {
  if (normalizeAnswer(a) === normalizeAnswer(b)) return true;
  const x = toNumber(a);
  const y = toNumber(b);
  if (x == null || y == null) return false;
  return Math.abs(x - y) <= Math.max(1e-6, Math.abs(y) * 1e-4);
}

/** Grade a submission. MCQ submissions are option text (or the option letter). */
export function grade(q: { type: "MCQ" | "TITA"; answer: string; options?: string[] | null }, submitted: string): boolean {
  if (!submitted?.trim()) return false;
  if (q.type === "MCQ" && q.options && /^[A-Da-d]$/.test(submitted.trim())) {
    const idx = submitted.trim().toUpperCase().charCodeAt(0) - 65;
    return answersMatch(q.options[idx] ?? "", q.answer);
  }
  return answersMatch(submitted, q.answer);
}
