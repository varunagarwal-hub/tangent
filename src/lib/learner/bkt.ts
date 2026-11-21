/**
 * Bayesian Knowledge Tracing, per concept. Deterministic — no AI here.
 * Standard posterior update on the observation, then the learning transition.
 */

export const BKT = {
  pL0: 0.3,
  pT: 0.15,
  pS: 0.1,
  pG: { MCQ: 0.25, TITA: 0.05 },
} as const;

export type QuestionType = "MCQ" | "TITA";
export type Verdict = "sound" | "flawed" | "unknown";

const clamp01 = (x: number) => Math.min(0.999, Math.max(0.001, x));

/** P(L | observation), before the learning transition. */
export function posterior(p: number, correct: boolean, type: QuestionType): number {
  const g = BKT.pG[type];
  const s = BKT.pS;
  if (correct) {
    const num = p * (1 - s);
    return num / (num + (1 - p) * g);
  }
  const num = p * s;
  return num / (num + (1 - p) * (1 - g));
}

/** Learning transition: the student may have learned from this attempt. */
export function learn(p: number): number {
  return p + (1 - p) * BKT.pT;
}

/** Plain BKT step: posterior then learning. */
export function bktUpdate(p: number, correct: boolean, type: QuestionType): number {
  return clamp01(learn(posterior(p, correct, type)));
}

export const SLOW_RATIO = 1.5;
export const SLOW_CREDIT = 0.7;
export const FLAWED_WEIGHT = 0.5;

export interface Evidence {
  correct: boolean;
  type: QuestionType;
  verdict?: Verdict;
  /** time_sec / target_time_sec */
  timeRatio?: number;
}

/**
 * BKT with Tangent's evidence adjustments:
 * - correct but flawed reasoning → 50/50 between the correct and incorrect updates
 *   (right answer, wrong reasoning is only half-credit evidence)
 * - correct but slow (> 1.5× target) → only 70% of the way from the prior to the
 *   correct update (speed is part of mastery in CAT)
 */
export function updateMastery(p: number, e: Evidence): number {
  const up = bktUpdate(p, true, e.type);
  const down = bktUpdate(p, false, e.type);
  if (!e.correct) return down;

  let next = up;
  if (e.verdict === "flawed") next = FLAWED_WEIGHT * up + (1 - FLAWED_WEIGHT) * down;
  if ((e.timeRatio ?? 1) > SLOW_RATIO) next = p + SLOW_CREDIT * (next - p);
  return clamp01(next);
}

/** Prior for an untouched concept from its prerequisites' mastery. */
export function priorFromPrereqs(prereqMastery: number[]): number {
  if (prereqMastery.length === 0) return BKT.pL0;
  const mean = prereqMastery.reduce((a, b) => a + b, 0) / prereqMastery.length;
  return 0.2 + 0.6 * mean;
}

export const PREREQ_READY_THRESHOLD = 0.4;

/** A concept is "ready" only if every prerequisite is ≥ 0.4; otherwise drill the prerequisite first. */
export function isReady(prereqs: string[], mastery: Record<string, number | undefined>): boolean {
  return prereqs.every((id) => (mastery[id] ?? BKT.pL0) >= PREREQ_READY_THRESHOLD);
}

/** Weakest prerequisite below the threshold, if any. */
export function blockingPrereq(prereqs: string[], mastery: Record<string, number | undefined>): string | null {
  let worst: string | null = null;
  let worstP = PREREQ_READY_THRESHOLD;
  for (const id of prereqs) {
    const p = mastery[id] ?? BKT.pL0;
    if (p < worstP) {
      worst = id;
      worstP = p;
    }
  }
  return worst;
}

export type MasteryBand = "low" | "mid" | "high" | "unknown";
export function masteryBand(p: number | null | undefined, attempts = 1): MasteryBand {
  if (p == null || attempts === 0) return "unknown";
  if (p < 0.4) return "low";
  if (p <= 0.7) return "mid";
  return "high";
}
