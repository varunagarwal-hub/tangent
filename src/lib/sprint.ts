/**
 * CAT speed sprint: deterministic mental-maths generators (no AI). Pure, safe on client and server.
 * Every item is {prompt, answer, tol}; a typed number is correct when |typed − answer| ≤ tol.
 */

export type SprintKind = "frac_pct" | "pct_frac" | "square" | "cube" | "pct_change" | "discount" | "multiply" | "ratio" | "remainder";
export type SprintCategory = "all" | "percent" | "squares" | "fractions";

export interface SprintItem {
  id: string;
  kind: SprintKind;
  prompt: string;
  answer: number;
  tol: number;
  display: string; // the answer as shown after a miss
}

export const SPRINT_SECONDS = 60;
export const KIND_LABEL: Record<SprintKind, string> = {
  frac_pct: "Fraction → %",
  pct_frac: "% → fraction",
  square: "Squares",
  cube: "Cubes",
  pct_change: "% change",
  discount: "Successive discounts",
  multiply: "Quick multiplication",
  ratio: "Ratio splits",
  remainder: "Divisibility",
};
export const CATEGORIES: { id: SprintCategory; label: string; kinds: SprintKind[] }[] = [
  { id: "all", label: "All", kinds: ["frac_pct", "pct_frac", "square", "cube", "pct_change", "discount", "multiply", "ratio", "remainder"] },
  { id: "percent", label: "Percentages", kinds: ["pct_change", "discount", "frac_pct"] },
  { id: "squares", label: "Squares & cubes", kinds: ["square", "cube"] },
  { id: "fractions", label: "Fractions", kinds: ["frac_pct", "pct_frac", "ratio"] },
];

/** Small fast seeded RNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type R = () => number;
const int = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: R, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const round2 = (x: number) => Math.round(x * 100) / 100;
const fmt = (x: number) => (Number.isInteger(x) ? x.toLocaleString("en-IN") : String(round2(x)));
const signed = (x: number) => (x > 0 ? `+${fmt(x)}` : x < 0 ? `−${fmt(-x)}` : "0");

type Gen = (r: R) => Omit<SprintItem, "id" | "kind">;

export const GENERATORS: Record<SprintKind, Gen> = {
  frac_pct: (r) => {
    const n = int(r, 2, 20);
    const a = 100 / n;
    return { prompt: `1/${n} as a %`, answer: a, tol: Number.isInteger(a) ? 0 : 0.06, display: `${fmt(a)}%` };
  },
  pct_frac: (r) => {
    const n = pick(r, [3, 6, 7, 8, 9, 11, 12, 16] as const);
    const shown = Math.floor((100 / n) * 100) / 100; // CAT tables truncate: 14.28, 11.11, 6.25
    return { prompt: `${shown}% = 1/?`, answer: n, tol: 0, display: `1/${n}` };
  },
  square: (r) => {
    const n = int(r, 11, 30);
    return { prompt: `${n}²`, answer: n * n, tol: 0, display: fmt(n * n) };
  },
  cube: (r) => {
    const n = int(r, 4, 15);
    return { prompt: `${n}³`, answer: n ** 3, tol: 0, display: fmt(n ** 3) };
  },
  pct_change: (r) => {
    const up = pick(r, [10, 20, 25, 30, 40, 50] as const);
    const down = pick(r, [10, 20, 25, 30, 40, 50] as const);
    const upFirst = r() < 0.5;
    const net = round2(((1 + up / 100) * (1 - down / 100) - 1) * 100);
    const steps = upFirst ? `+${up}% then −${down}%` : `−${down}% then +${up}%`;
    return { prompt: `${steps}: net % change?`, answer: net, tol: 0.01, display: `${signed(net)}%` };
  },
  discount: (r) => {
    const a = pick(r, [10, 15, 20, 25, 30, 40] as const);
    const b = pick(r, [5, 10, 15, 20, 25] as const);
    const eq = round2(a + b - (a * b) / 100);
    return { prompt: `Discounts of ${a}% and ${b}%: single equivalent %?`, answer: eq, tol: 0.01, display: `${fmt(eq)}%` };
  },
  multiply: (r) => {
    const kind = int(r, 0, 2);
    if (kind === 0) {
      const n = int(r, 12, 99);
      return { prompt: `${n} × 11`, answer: n * 11, tol: 0, display: fmt(n * 11) };
    }
    if (kind === 1) {
      const n = 4 * int(r, 3, 40);
      return { prompt: `${n} × 25`, answer: n * 25, tol: 0, display: fmt(n * 25) };
    }
    const a = int(r, 91, 99);
    const b = int(r, 91, 99);
    return { prompt: `${a} × ${b}`, answer: a * b, tol: 0, display: fmt(a * b) };
  },
  ratio: (r) => {
    let a = int(r, 1, 7);
    let b = int(r, 2, 9);
    if (a === b) b += 1;
    if (a > b) [a, b] = [b, a];
    const unit = int(r, 4, 30);
    const total = unit * (a + b);
    const bigger = r() < 0.5;
    return {
      prompt: `Split ${fmt(total)} in ${a}:${b}. The ${bigger ? "larger" : "smaller"} part?`,
      answer: unit * (bigger ? b : a),
      tol: 0,
      display: fmt(unit * (bigger ? b : a)),
    };
  },
  remainder: (r) => {
    const d = pick(r, [3, 4, 8, 9, 11] as const);
    const n = int(r, 1000, 99999);
    return { prompt: `${n} ÷ ${d}: remainder?`, answer: n % d, tol: 0, display: String(n % d) };
  },
};

/** A round of up to `count` items for a category, no repeated prompt, seeded. */
export function makeRound(seed: number, category: SprintCategory = "all", count = 60): SprintItem[] {
  const r = rng(seed);
  const kinds = (CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0]).kinds;
  const out: SprintItem[] = [];
  const seen = new Set<string>();
  let last: SprintKind | null = null;
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const kind = pick(r, kinds);
    if (kinds.length > 1 && kind === last && tries < count * 10) continue; // vary the rhythm while there is variety left
    const item = GENERATORS[kind](r);
    if (seen.has(item.prompt)) continue;
    seen.add(item.prompt);
    last = kind;
    out.push({ id: `${seed}-${out.length}`, kind, ...item });
  }
  return out;
}

/** Parse what the student typed ("−10", "14.29", "1,350") and check it. */
export function checkAnswer(item: SprintItem, typed: string): boolean {
  const s = typed.replace(/[,%\s]/g, "").replace(/[−–]/g, "-");
  if (!/^-?\d*\.?\d+$/.test(s)) return false;
  return Math.abs(Number(s) - item.answer) <= item.tol + 1e-9;
}
