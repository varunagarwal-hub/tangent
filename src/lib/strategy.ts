import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai/gemini";
import { CONCEPTS, getConcept } from "@/lib/content";
import { CONFIDENCE_LABEL, CONFIDENCE_VALUE, type Confidence } from "@/lib/learner";
import type { CalibrationData, SkipCoachData, StrategyData } from "@/lib/api-types";

const s = schema;
const PRIOR = 0.3;

/** CAT marks: +3 correct, −1 wrong MCQ, 0 wrong TITA. */
export function catMarks(correct: boolean, type: "MCQ" | "TITA") {
  return correct ? 3 : type === "MCQ" ? -1 : 0;
}

/** Mastery of a concept just before time t, from the stored history. */
function masteryBefore(history: { t: string; p: number }[], t: Date) {
  let p = PRIOR;
  for (const h of history) {
    if (new Date(h.t).getTime() < t.getTime()) p = h.p;
    else break;
  }
  return p;
}

const InsightOutput = z.object({ insight: z.string() });

export async function getStrategyData(studentId: string): Promise<StrategyData> {
  const [attempts, mastery, questions] = await Promise.all([
    db.select().from(s.attempts).where(eq(s.attempts.studentId, studentId)).orderBy(s.attempts.createdAt),
    db.select().from(s.mastery).where(eq(s.mastery.studentId, studentId)),
    db.select({ id: s.questions.id, type: s.questions.type }).from(s.questions),
  ]);
  const typeById = new Map(questions.map((q) => [q.id, q.type]));
  const historyBy = new Map(mastery.map((m) => [m.conceptId, [...(m.history ?? [])].sort((a, b) => a.t.localeCompare(b.t))]));

  const rows = attempts.map((a) => {
    const type = (a.questionId && typeById.get(a.questionId)) || "MCQ";
    return {
      correct: a.isCorrect,
      type,
      marks: catMarks(a.isCorrect, type),
      p: masteryBefore(historyBy.get(a.conceptId) ?? [], new Date(a.createdAt)),
      confidence: a.confidence as Confidence | null,
      area: getConcept(a.conceptId).area,
    };
  });

  /* ── Skip Coach: replay history under "attempt only if mastery ≥ θ" ── */
  const actualScore = rows.reduce((a, r) => a + r.marks, 0);
  const curve = Array.from({ length: 19 }, (_, i) => +(i * 0.05).toFixed(2)).map((threshold) => {
    const kept = rows.filter((r) => r.p >= threshold);
    return { threshold, score: kept.reduce((a, r) => a + r.marks, 0), attempted: kept.length, skipped: rows.length - kept.length };
  });
  const bestPoint = curve.reduce((b, c) => (c.score > b.score ? c : b), curve[0]);
  const guessKept = rows.filter((r) => r.confidence !== 1);
  const guessScore = guessKept.reduce((a, r) => a + r.marks, 0);
  const negativeMarks = rows.filter((r) => !r.correct && r.type === "MCQ").length;

  /* ── Calibration ── */
  const byConfidence = ([1, 2, 3] as const).map((level) => {
    const xs = rows.filter((r) => r.confidence === level);
    return {
      level,
      label: CONFIDENCE_LABEL[level],
      expected: CONFIDENCE_VALUE[level],
      accuracy: xs.length ? xs.filter((r) => r.correct).length / xs.length : null,
      n: xs.length,
    };
  });
  const areas = [...new Set(CONCEPTS.map((c) => c.area))];
  const byArea = areas.map((area) => {
    const xs = rows.filter((r) => r.area === area && r.confidence != null);
    if (!xs.length) return { area, avgConfidence: null, accuracy: null, gap: null, n: 0 };
    const avgConfidence = xs.reduce((a, r) => a + CONFIDENCE_VALUE[r.confidence!], 0) / xs.length;
    const accuracy = xs.filter((r) => r.correct).length / xs.length;
    return { area, avgConfidence, accuracy, gap: avgConfidence - accuracy, n: xs.length };
  });
  const rated = rows.filter((r) => r.confidence != null);
  const oc = rated.length ? rated.reduce((a, r) => a + CONFIDENCE_VALUE[r.confidence!], 0) / rated.length : null;
  const oa = rated.length ? rated.filter((r) => r.correct).length / rated.length : null;
  const calibration: CalibrationData = {
    byConfidence,
    byArea,
    confidentlyWrong: rows.filter((r) => r.confidence === 3 && !r.correct).length,
    overall: { avgConfidence: oc, accuracy: oa, gap: oc != null && oa != null ? oc - oa : null },
  };

  /* ── Sprint mode: weight × (1 − p) / time-to-improve (more attempts already = slower to move) ── */
  const mBy = new Map(mastery.map((m) => [m.conceptId, m]));
  const sprint = CONCEPTS.map((c) => {
    const m = mBy.get(c.id);
    const p = m?.pMastery ?? null;
    const effort = 1 + Math.log1p(m?.attempts ?? 0) * 0.3 + (m && m.avgTimeRatio > 1.3 ? 0.3 : 0);
    return { conceptId: c.id, name: c.name, area: c.area, weight: c.weight, p, score: +((c.weight * (1 - (p ?? PRIOR))) / effort).toFixed(3) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const skipBase: Omit<SkipCoachData, "insight"> = {
    attempts: rows.length,
    actualScore,
    curve,
    best: { threshold: bestPoint.threshold, score: bestPoint.score, gain: bestPoint.score - actualScore, skipped: bestPoint.skipped },
    skipGuesses: { score: guessScore, gain: guessScore - actualScore, skipped: rows.length - guessKept.length },
    negativeMarks,
  };

  const fallback =
    skipBase.best.gain > 0
      ? `Across your last ${rows.length} questions, skipping anything below ${Math.round(bestPoint.threshold * 100)}% mastery would have added ${skipBase.best.gain} marks. You lost ${negativeMarks} marks to wrong MCQs. In CAT, a skip costs nothing; a confident guess costs one.`
      : `Your attempt choices are already sound: no mastery cut-off would have beaten your actual score of ${actualScore}. Keep attempting what you know and keep skipping blind guesses.`;
  let insight = fallback;
  try {
    const { data } = await generateStructured({
      agent: "coach",
      tier: "fast",
      system:
        "You are the Skip Coach in Tangent, a warm, sharp CAT Quant mentor (Indian English). Write 2–3 sentences of strategy from the numbers given: what skipping would have changed, where calibration is off, and one concrete rule to follow in the next mock. Use 'you'. No percentile predictions. Plain text, no markdown.",
      prompt: [
        `Questions answered: ${rows.length}. Actual CAT-style score: ${actualScore} (+3 correct, −1 wrong MCQ, 0 wrong TITA).`,
        `Marks lost to wrong MCQs (negative marking): ${negativeMarks}.`,
        skipBase.best.gain > 0
          ? `RULE A, skip by MASTERY: attempting only questions on concepts where your mastery was at least ${Math.round(bestPoint.threshold * 100)}% would have skipped ${bestPoint.skipped} questions and changed the score by +${skipBase.best.gain}.`
          : `RULE A, skip by MASTERY: no mastery cut-off would have improved the score; the student's attempt choices by mastery were already sound. Say this plainly; do not mention any percentage threshold.`,
        `RULE B, skip by CONFIDENCE: skipping the ${skipBase.skipGuesses.skipped} answers marked "Guessing" would have changed the score by ${skipBase.skipGuesses.gain >= 0 ? "+" : ""}${skipBase.skipGuesses.gain}.`,
        `"Certain" but wrong: ${calibration.confidentlyWrong} times.`,
        `Most overconfident area: ${byArea.filter((a) => a.gap != null && a.n >= 3).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0]?.area ?? "none"}.`,
        `Use ONLY these numbers, and keep the mastery rule and the confidence rule distinct. If a rule's change is zero or negative, say that rule wouldn't have helped.`,
        `Never write "Rule A" or "Rule B": the student has never seen those labels. Describe each rule in plain words, e.g. "skipping questions below 40% mastery" or "skipping the ones you marked Guessing".`,
      ].join("\n"),
      schema: InsightOutput,
      studentId,
      inputSummary: "skip coach insight",
      thinking: "LOW",
      timeoutMs: 10_000,
    });
    insight = data.insight.trim();
  } catch {
    /* fallback text */
  }

  return { skip: { ...skipBase, insight }, calibration, sprint };
}
