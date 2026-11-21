/**
 * The learner model: one pure function that turns an attempt into new state.
 * Used by the live answer route AND the seed simulation, so synthetic students
 * are produced by exactly the same math as real ones.
 */
import { updateMastery, type QuestionType, type Verdict } from "./bkt";
import { eloUpdate, ELO_START } from "./elo";
import { updateCalibration, type Confidence } from "./calibration";
import { ratingFor, review, type ReviewRating, type StoredCard } from "./fsrs";

export * from "./bkt";
export * from "./elo";
export * from "./calibration";
export * from "./fsrs";

export const TIME_EMA_ALPHA = 0.3;

export interface ConceptState {
  pMastery: number;
  elo: number;
  avgTimeRatio: number;
  calibration: number;
  attempts: number;
  card: StoredCard | null;
}

export interface AttemptInput {
  correct: boolean;
  type: QuestionType;
  verdict?: Verdict;
  timeSec: number;
  targetTimeSec: number;
  confidence?: Confidence | null;
  questionElo: number;
  questionAttempts: number;
}

export interface AttemptResult {
  concept: ConceptState;
  questionElo: number;
  expectedCorrect: number;
  rating: ReviewRating;
  dueAt: Date;
  /** p before and after, for "mastery ticks up" animations */
  delta: number;
}

export function initialConceptState(prior: number): ConceptState {
  return { pMastery: prior, elo: ELO_START, avgTimeRatio: 1, calibration: 0, attempts: 0, card: null };
}

export function applyAttempt(prev: ConceptState, a: AttemptInput, now = new Date()): AttemptResult {
  const timeRatio = a.targetTimeSec > 0 ? a.timeSec / a.targetTimeSec : 1;
  const pMastery = updateMastery(prev.pMastery, { correct: a.correct, type: a.type, verdict: a.verdict, timeRatio });
  const elo = eloUpdate(prev.elo, a.questionElo, a.correct, a.questionAttempts);
  const avgTimeRatio =
    prev.attempts === 0 ? timeRatio : prev.avgTimeRatio + TIME_EMA_ALPHA * (timeRatio - prev.avgTimeRatio);
  const calibration = updateCalibration(prev.calibration, a.confidence, a.correct);
  const rating = ratingFor({ correct: a.correct, verdict: a.verdict, timeRatio, confidence: a.confidence });
  const sched = review(prev.card, rating, now);

  return {
    concept: { pMastery, elo: elo.student, avgTimeRatio, calibration, attempts: prev.attempts + 1, card: sched.card },
    questionElo: elo.question,
    expectedCorrect: elo.expected,
    rating,
    dueAt: sched.due,
    delta: pMastery - prev.pMastery,
  };
}

/* ── Misconception lifecycle ───────────────────────────────────────────────
 * detected → fixing (contrast question served) → resolved after 2 clean correct
 * answers with sound reasoning on that concept. Recurrence reopens it.
 */
export type MisconceptionStatus = "detected" | "fixing" | "resolved";
export interface MisconceptionLife {
  status: MisconceptionStatus;
  evidenceCount: number;
  cleanCount: number;
}
export const CLEAN_TO_RESOLVE = 2;

export type LifecycleEvent =
  | { kind: "detected" } // detective attributed an error to this misconception
  | { kind: "contrast_served" }
  | { kind: "clean_correct" }; // correct + sound reasoning on the misconception's concept

export function stepMisconception(prev: MisconceptionLife | null, ev: LifecycleEvent): MisconceptionLife {
  const cur = prev ?? { status: "detected" as const, evidenceCount: 0, cleanCount: 0 };
  switch (ev.kind) {
    case "detected":
      // new evidence, or a recurrence of a resolved one: reopen and reset the clean streak
      return { status: "detected", evidenceCount: cur.evidenceCount + 1, cleanCount: 0 };
    case "contrast_served":
      return cur.status === "resolved" ? cur : { ...cur, status: "fixing" };
    case "clean_correct": {
      if (cur.status === "resolved") return cur;
      const cleanCount = cur.cleanCount + 1;
      return { ...cur, cleanCount, status: cleanCount >= CLEAN_TO_RESOLVE ? "resolved" : "fixing" };
    }
  }
}
