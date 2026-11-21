/**
 * Confidence calibration: gap between how sure the student felt and how often
 * they were right. Positive = overconfident, negative = underconfident.
 */

export type Confidence = 1 | 2 | 3; // Guessing / Fairly sure / Certain

export const CONFIDENCE_VALUE: Record<Confidence, number> = { 1: 0.33, 2: 0.66, 3: 1 };
export const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: "Guessing", 2: "Fairly sure", 3: "Certain" };

/** EMA smoothing for the stored per-concept calibration gap. */
export const CALIBRATION_ALPHA = 0.2;

export function updateCalibration(prevGap: number, confidence: Confidence | null | undefined, correct: boolean): number {
  if (!confidence) return prevGap;
  const gap = CONFIDENCE_VALUE[confidence] - (correct ? 1 : 0);
  return prevGap + CALIBRATION_ALPHA * (gap - prevGap);
}

/** Batch version for charts: avg confidence vs accuracy over a set of attempts. */
export function calibrationSummary(rows: { confidence: Confidence | null; isCorrect: boolean }[]) {
  const rated = rows.filter((r): r is { confidence: Confidence; isCorrect: boolean } => r.confidence != null);
  if (rated.length === 0) return { avgConfidence: null, accuracy: null, gap: null, n: 0 };
  const avgConfidence = rated.reduce((a, r) => a + CONFIDENCE_VALUE[r.confidence], 0) / rated.length;
  const accuracy = rated.filter((r) => r.isCorrect).length / rated.length;
  return { avgConfidence, accuracy, gap: avgConfidence - accuracy, n: rated.length };
}

/** "Certain" and wrong: raises the misconception prior and feeds the Skip Coach. */
export function isConfidentlyWrong(confidence: Confidence | null | undefined, correct: boolean): boolean {
  return confidence === 3 && !correct;
}

/** Detective hint: confidently-wrong answers point at a held belief, not a slip. */
export function misconceptionPriorBoost(confidence: Confidence | null | undefined, correct: boolean): number {
  return isConfidentlyWrong(confidence, correct) ? 0.25 : 0;
}
