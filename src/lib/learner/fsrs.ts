/**
 * Spaced repetition via ts-fsrs. One card per concept + one per active misconception.
 */
import { createEmptyCard, fsrs, FSRS6_DEFAULT_DECAY, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { Verdict } from "./bkt";
import type { Confidence } from "./calibration";

const scheduler = fsrs({ enable_fuzz: false });

export { Rating };
export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

const GRADE: Record<ReviewRating, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

/**
 * Again = wrong. Hard = correct but slow, flawed or low-confidence.
 * Easy = correct, fast (≤ 0.75× target) and certain. Good = otherwise correct.
 */
export function ratingFor(a: {
  correct: boolean;
  verdict?: Verdict;
  timeRatio?: number;
  confidence?: Confidence | null;
}): ReviewRating {
  if (!a.correct) return "Again";
  const t = a.timeRatio ?? 1;
  if (a.verdict === "flawed" || t > 1.5 || a.confidence === 1) return "Hard";
  if (t <= 0.75 && a.confidence === 3) return "Easy";
  return "Good";
}

/** JSON-safe card (dates as ISO strings) for the review_cards.fsrs_state column. */
export type StoredCard = Omit<Card, "due" | "last_review"> & { due: string; last_review?: string | null };

export function toStored(card: Card): StoredCard {
  return { ...card, due: card.due.toISOString(), last_review: card.last_review ? card.last_review.toISOString() : null };
}

export function fromStored(s: StoredCard): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined } as Card;
}

export function newCard(now = new Date()): Card {
  return createEmptyCard(now);
}

/** Schedule the next review. Pass null for a brand-new item. */
export function review(stored: StoredCard | null, rating: ReviewRating, now = new Date()) {
  const card = stored ? fromStored(stored) : newCard(now);
  const { card: next } = scheduler.next(card, now, GRADE[rating]);
  return { card: toStored(next), due: next.due };
}

/**
 * Probability the student still recalls the item now, from the FSRS-6 forgetting
 * curve: R(t) = (1 + factor · t / S)^(−decay), with factor chosen so R(S) = 0.9.
 */
export function retrievability(stored: StoredCard | null, now = new Date()): number {
  if (!stored || stored.state === State.New || !stored.last_review || stored.stability <= 0) return 1;
  const days = Math.max(0, (now.getTime() - new Date(stored.last_review).getTime()) / 86_400_000);
  const decay = FSRS6_DEFAULT_DECAY;
  const factor = Math.pow(0.9, -1 / decay) - 1;
  return Math.pow(1 + (factor * days) / stored.stability, -decay);
}

/**
 * Node opacity on the Mastery Map: fully opaque when fresh, fading toward 0.35 as the
 * item becomes due (forgetting curve made visible).
 */
export function fadeOpacity(stored: StoredCard | null, now = new Date()): number {
  const r = retrievability(stored, now);
  return 0.35 + 0.65 * Math.max(0, Math.min(1, (r - 0.7) / 0.3));
}

export function isDue(dueAt: Date | string, now = new Date()): boolean {
  return new Date(dueAt).getTime() <= now.getTime();
}
