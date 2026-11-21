/**
 * Elo for difficulty calibration. Students and questions share one scale, so every
 * attempt (from any student) calibrates the question.
 */

export const ELO_START = 1200;
export const STUDENT_K = 32;
export const QUESTION_K_NEW = 24; // < 10 attempts
export const QUESTION_K_SETTLED = 12;
export const RETIRE_ABOVE = 2000;
export const RETIRE_BELOW = 600;

/** P(student answers correctly). */
export function expectedCorrect(studentElo: number, questionElo: number): number {
  return 1 / (1 + Math.pow(10, (questionElo - studentElo) / 400));
}

export function eloUpdate(studentElo: number, questionElo: number, correct: boolean, questionAttempts: number) {
  const p = expectedCorrect(studentElo, questionElo);
  const score = correct ? 1 : 0;
  const qK = questionAttempts < 10 ? QUESTION_K_NEW : QUESTION_K_SETTLED;
  return {
    student: studentElo + STUDENT_K * (score - p),
    question: questionElo - qK * (score - p),
    expected: p,
  };
}

/** Target P(correct) band for "desirable difficulty". */
export const TARGET_P = { min: 0.6, max: 0.7, mid: 0.65 } as const;

/** Question Elo that gives P(correct) = p for this student (p = 0.65 → s − 108). */
export function targetQuestionElo(studentElo: number, p: number = TARGET_P.mid): number {
  return studentElo + 400 * Math.log10(1 / p - 1);
}

/**
 * Pick the question whose predicted P(correct) is inside [0.6, 0.7], closest to 0.65.
 * Falls back to the nearest one overall if none is in the band.
 */
export function pickByDifficulty<T extends { difficultyElo: number }>(studentElo: number, questions: T[]): T | null {
  if (questions.length === 0) return null;
  const scored = questions.map((q) => ({ q, p: expectedCorrect(studentElo, q.difficultyElo) }));
  const inBand = scored.filter((s) => s.p >= TARGET_P.min && s.p <= TARGET_P.max);
  const pool = inBand.length ? inBand : scored;
  pool.sort((a, b) => Math.abs(a.p - TARGET_P.mid) - Math.abs(b.p - TARGET_P.mid));
  return pool[0].q;
}

export function shouldRetire(q: { difficultyElo: number; flagCount: number }): boolean {
  return q.flagCount >= 2 || q.difficultyElo > RETIRE_ABOVE || q.difficultyElo < RETIRE_BELOW;
}

/** Difficulty band label for the pre-verified pool. */
export function difficultyBand(elo: number): "easy" | "medium" | "hard" {
  if (elo < 1100) return "easy";
  if (elo < 1350) return "medium";
  return "hard";
}
