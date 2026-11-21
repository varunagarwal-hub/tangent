import "server-only";
import { and, desc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CONCEPTS, getConcept, getMisconception } from "@/lib/content";
import * as L from "@/lib/learner";
import type { MasteryNode, PublicQuestion } from "@/lib/api-types";
import type { Question } from "@/lib/db/schema";

const s = schema;

/* ── questions ─────────────────────────────────────────────────────────── */

export function toPublic(q: Question): PublicQuestion {
  const c = getConcept(q.conceptId);
  return {
    id: q.id,
    conceptId: q.conceptId,
    conceptName: c.name,
    area: c.area,
    type: q.type,
    stem: q.stem,
    options: q.options ?? null,
    targetTimeSec: c.target_time_sec,
    difficultyElo: q.difficultyElo,
    source: q.source,
  };
}

export async function getQuestion(id: string) {
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, id));
  return q ?? null;
}

/** Question ids this student answered recently (to avoid repeats). */
export async function recentQuestionIds(studentId: string, limit = 25): Promise<string[]> {
  const rows = await db
    .select({ id: s.attempts.questionId })
    .from(s.attempts)
    .where(eq(s.attempts.studentId, studentId))
    .orderBy(desc(s.attempts.createdAt))
    .limit(limit);
  return rows.map((r) => r.id).filter((x): x is string => !!x);
}

/**
 * Pick an active question for a concept at the target difficulty (P(correct) 0.6–0.7).
 * With targetMisconceptionId, prefer questions built to expose it (contrast questions).
 */
export async function pickQuestion(opts: {
  conceptId: string;
  studentElo: number;
  exclude?: string[];
  targetMisconceptionId?: string | null;
}): Promise<Question | null> {
  const where = [eq(s.questions.conceptId, opts.conceptId), eq(s.questions.status, "active")];
  if (opts.exclude?.length) where.push(notInArray(s.questions.id, opts.exclude));
  let pool = await db.select().from(s.questions).where(and(...where));
  if (!pool.length && opts.exclude?.length) {
    pool = await db.select().from(s.questions).where(and(eq(s.questions.conceptId, opts.conceptId), eq(s.questions.status, "active")));
  }
  if (!pool.length) return null;
  if (opts.targetMisconceptionId) {
    const m = opts.targetMisconceptionId;
    const targeted = pool.filter(
      (q) => q.targetsMisconceptionId === m || (q.distractorMisconceptions ?? []).some((d) => d.misconception_id === m),
    );
    if (targeted.length) pool = targeted;
  }
  return L.pickByDifficulty(opts.studentElo, pool);
}

/** Count active questions per difficulty band for the pool refill. */
export async function poolSize(conceptId: string, band: "easy" | "medium" | "hard") {
  const range = band === "easy" ? [0, 1100] : band === "medium" ? [1100, 1350] : [1350, 5000];
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.questions)
    .where(
      and(
        eq(s.questions.conceptId, conceptId),
        eq(s.questions.status, "active"),
        sql`${s.questions.difficultyElo} >= ${range[0]} and ${s.questions.difficultyElo} < ${range[1]}`,
      ),
    );
  return r?.n ?? 0;
}

/* ── mastery ───────────────────────────────────────────────────────────── */

export async function getMasteryRows(studentId: string) {
  return db.select().from(s.mastery).where(eq(s.mastery.studentId, studentId));
}

export async function masteryMap(studentId: string): Promise<Record<string, number>> {
  const rows = await getMasteryRows(studentId);
  return Object.fromEntries(rows.map((r) => [r.conceptId, r.pMastery]));
}

/** Concept state for the learner model (with prerequisite-propagated prior when untouched). */
export async function conceptState(studentId: string, conceptId: string) {
  const rows = await getMasteryRows(studentId);
  const row = rows.find((r) => r.conceptId === conceptId);
  const [card] = await db
    .select()
    .from(s.reviewCards)
    .where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "concept"), eq(s.reviewCards.itemId, conceptId)));
  if (row) {
    return {
      exists: true,
      state: {
        pMastery: row.pMastery,
        elo: row.elo,
        avgTimeRatio: row.avgTimeRatio,
        calibration: row.calibration,
        attempts: row.attempts,
        card: (card?.fsrsState as L.StoredCard) ?? null,
      },
      history: row.history ?? [],
    };
  }
  const map = Object.fromEntries(rows.map((r) => [r.conceptId, r.pMastery]));
  const prereqs = getConcept(conceptId).prerequisites.map((p) => map[p]).filter((x): x is number => x != null);
  return { exists: false, state: L.initialConceptState(L.priorFromPrereqs(prereqs)), history: [] as { t: string; p: number }[] };
}

/** Average student Elo across touched concepts (for untouched concepts). */
export async function studentElo(studentId: string, conceptId?: string) {
  const rows = await getMasteryRows(studentId);
  const hit = conceptId ? rows.find((r) => r.conceptId === conceptId) : null;
  if (hit) return hit.elo;
  return rows.length ? rows.reduce((a, r) => a + r.elo, 0) / rows.length : L.ELO_START;
}

export async function masteryNodes(studentId: string, now = new Date()): Promise<MasteryNode[]> {
  const rows = await getMasteryRows(studentId);
  const cards = await db
    .select()
    .from(s.reviewCards)
    .where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "concept")));
  const byConcept = new Map(rows.map((r) => [r.conceptId, r]));
  const cardBy = new Map(cards.map((c) => [c.itemId, c.fsrsState as L.StoredCard]));
  return CONCEPTS.map((c) => {
    const r = byConcept.get(c.id);
    return {
      conceptId: c.id,
      name: c.name,
      area: c.area,
      prerequisites: c.prerequisites,
      p: r ? r.pMastery : null,
      attempts: r?.attempts ?? 0,
      opacity: r ? L.fadeOpacity(cardBy.get(c.id) ?? null, now) : 1,
    };
  });
}

/* ── attempts ──────────────────────────────────────────────────────────── */

export interface RecordInput {
  studentId: string;
  question: Question;
  answer: string;
  correct: boolean;
  timeSec: number;
  confidence: L.Confidence | null;
  mode: "diagnostic" | "practice" | "review" | "contrast";
  workText?: string | null;
}

/**
 * Applies the learner model (BKT + Elo + calibration + FSRS) and persists everything.
 * Reasoning verdict is "unknown" at this point; the detective may refine it later
 * via applyDiagnosis (we stash the pre-attempt state for that).
 */
export async function recordAttempt(r: RecordInput) {
  const concept = getConcept(r.question.conceptId);
  const cs = await conceptState(r.studentId, concept.id);
  const now = new Date();
  const res = L.applyAttempt(
    cs.state,
    {
      correct: r.correct,
      type: r.question.type,
      verdict: "unknown",
      timeSec: r.timeSec,
      targetTimeSec: concept.target_time_sec,
      confidence: r.confidence,
      questionElo: r.question.difficultyElo,
      questionAttempts: r.question.attemptsCount,
    },
    now,
  );

  const [attempt] = await db
    .insert(s.attempts)
    .values({
      studentId: r.studentId,
      questionId: r.question.id,
      conceptId: concept.id,
      answer: r.answer,
      isCorrect: r.correct,
      timeSec: r.timeSec,
      confidence: r.confidence,
      workText: r.workText ?? null,
      mode: r.mode,
      diagnosis: { prevState: cs.state, confidentlyWrong: L.isConfidentlyWrong(r.confidence, r.correct) },
    })
    .returning({ id: s.attempts.id });

  await saveConceptState(r.studentId, concept.id, res.concept, [...cs.history, { t: now.toISOString(), p: +res.concept.pMastery.toFixed(4) }], now);

  // question calibration loop (all students calibrate the question)
  const retired = L.shouldRetire({ difficultyElo: res.questionElo, flagCount: r.question.flagCount });
  await db
    .update(s.questions)
    .set({ difficultyElo: res.questionElo, attemptsCount: r.question.attemptsCount + 1, ...(retired ? { status: "retired" as const } : {}) })
    .where(eq(s.questions.id, r.question.id));

  return { attemptId: attempt.id, before: cs.state.pMastery, after: res.concept.pMastery, rating: res.rating };
}

async function saveConceptState(studentId: string, conceptId: string, st: L.ConceptState, history: { t: string; p: number }[], now: Date) {
  await db
    .insert(s.mastery)
    .values({
      studentId,
      conceptId,
      pMastery: st.pMastery,
      elo: st.elo,
      avgTimeRatio: st.avgTimeRatio,
      calibration: st.calibration,
      attempts: st.attempts,
      lastSeen: now,
      history: history.slice(-60),
    })
    .onConflictDoUpdate({
      target: [s.mastery.studentId, s.mastery.conceptId],
      set: {
        pMastery: st.pMastery,
        elo: st.elo,
        avgTimeRatio: st.avgTimeRatio,
        calibration: st.calibration,
        attempts: st.attempts,
        lastSeen: now,
        history: history.slice(-60),
      },
    });
  if (st.card) {
    await db
      .insert(s.reviewCards)
      .values({ studentId, itemType: "concept", itemId: conceptId, fsrsState: st.card, dueAt: new Date(st.card.due) })
      .onConflictDoUpdate({
        target: [s.reviewCards.studentId, s.reviewCards.itemType, s.reviewCards.itemId],
        set: { fsrsState: st.card, dueAt: new Date(st.card.due) },
      });
  }
}

/* ── misconception lifecycle ───────────────────────────────────────────── */

export async function getMisconceptionEvent(studentId: string, misconceptionId: string) {
  const [e] = await db
    .select()
    .from(s.misconceptionEvents)
    .where(and(eq(s.misconceptionEvents.studentId, studentId), eq(s.misconceptionEvents.misconceptionId, misconceptionId)));
  return e ?? null;
}

export async function activeMisconceptions(studentId: string) {
  return db
    .select()
    .from(s.misconceptionEvents)
    .where(and(eq(s.misconceptionEvents.studentId, studentId), inArray(s.misconceptionEvents.status, ["detected", "fixing"])))
    .orderBy(desc(s.misconceptionEvents.evidenceCount), desc(s.misconceptionEvents.updatedAt));
}

export async function stepLifecycle(studentId: string, misconceptionId: string, ev: L.LifecycleEvent) {
  const prev = await getMisconceptionEvent(studentId, misconceptionId);
  if (!prev && ev.kind !== "detected") return null;
  const next = L.stepMisconception(prev ? { status: prev.status, evidenceCount: prev.evidenceCount, cleanCount: prev.cleanCount } : null, ev);
  const now = new Date();
  await db
    .insert(s.misconceptionEvents)
    .values({ studentId, misconceptionId, ...next, updatedAt: now })
    .onConflictDoUpdate({
      target: [s.misconceptionEvents.studentId, s.misconceptionEvents.misconceptionId],
      set: { ...next, updatedAt: now },
    });
  // review card per active misconception
  if (ev.kind !== "contrast_served") {
    const [card] = await db
      .select()
      .from(s.reviewCards)
      .where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "misconception"), eq(s.reviewCards.itemId, misconceptionId)));
    if (next.status === "resolved") {
      if (card) await db.delete(s.reviewCards).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "misconception"), eq(s.reviewCards.itemId, misconceptionId)));
    } else {
      const sched = L.review((card?.fsrsState as L.StoredCard) ?? null, ev.kind === "detected" ? "Again" : "Good", now);
      await db
        .insert(s.reviewCards)
        .values({ studentId, itemType: "misconception", itemId: misconceptionId, fsrsState: sched.card, dueAt: sched.due })
        .onConflictDoUpdate({
          target: [s.reviewCards.studentId, s.reviewCards.itemType, s.reviewCards.itemId],
          set: { fsrsState: sched.card, dueAt: sched.due },
        });
    }
  }
  return next;
}

/**
 * Store the detective's diagnosis on the attempt and run the consequences:
 * - right answer / flawed reasoning → recompute mastery with the flawed-evidence rule
 * - misconception found → lifecycle "detected"
 * - correct + sound → "clean_correct" for active misconceptions on this concept
 */
export async function applyDiagnosis(a: {
  attemptId: string;
  studentId: string;
  verdict: "sound" | "flawed" | "unknown";
  misconceptionId: string | null;
  errorLine: string | null;
  transcription?: string | null;
  workText?: string | null;
  workImageUrl?: string | null;
  diagnosis: Record<string, unknown>;
  trace: unknown;
}) {
  const [att] = await db.select().from(s.attempts).where(eq(s.attempts.id, a.attemptId));
  if (!att) return { lifecycle: null };
  const prevDiag = (att.diagnosis ?? {}) as { prevState?: L.ConceptState };

  await db
    .update(s.attempts)
    .set({
      reasoningVerdict: a.verdict,
      misconceptionId: a.misconceptionId,
      errorLine: a.errorLine,
      ...(a.transcription !== undefined ? { transcription: a.transcription } : {}),
      ...(a.workText ? { workText: a.workText } : {}),
      ...(a.workImageUrl ? { workImageUrl: a.workImageUrl } : {}),
      diagnosis: { ...prevDiag, ...a.diagnosis },
      agentTrace: a.trace,
    })
    .where(eq(s.attempts.id, a.attemptId));

  // right answer, wrong reasoning → half-credit evidence
  if (att.isCorrect && a.verdict === "flawed" && prevDiag.prevState) {
    const concept = getConcept(att.conceptId);
    const [q] = att.questionId ? await db.select().from(s.questions).where(eq(s.questions.id, att.questionId)) : [];
    const p = L.updateMastery(prevDiag.prevState.pMastery, {
      correct: true,
      type: q?.type ?? "MCQ",
      verdict: "flawed",
      timeRatio: (att.timeSec ?? concept.target_time_sec) / concept.target_time_sec,
    });
    await db
      .update(s.mastery)
      .set({ pMastery: p })
      .where(and(eq(s.mastery.studentId, a.studentId), eq(s.mastery.conceptId, att.conceptId)));
  }

  let lifecycle: L.MisconceptionStatus | null = null;
  if (a.misconceptionId && getMisconception(a.misconceptionId)) {
    lifecycle = (await stepLifecycle(a.studentId, a.misconceptionId, { kind: "detected" }))?.status ?? null;
  } else if (att.isCorrect && a.verdict === "sound") {
    lifecycle = await creditCleanCorrect(a.studentId, att.conceptId);
  }
  return { lifecycle };
}

/** Correct + sound reasoning: counts toward resolving active misconceptions on this concept. */
export async function creditCleanCorrect(studentId: string, conceptId: string) {
  const active = (await activeMisconceptions(studentId)).filter((e) => getMisconception(e.misconceptionId)?.concept_id === conceptId);
  let last: L.MisconceptionStatus | null = null;
  for (const e of active) last = (await stepLifecycle(studentId, e.misconceptionId, { kind: "clean_correct" }))?.status ?? last;
  return last;
}

/* ── review + few-shot ─────────────────────────────────────────────────── */

export async function dueCards(studentId: string, now = new Date()) {
  return db
    .select()
    .from(s.reviewCards)
    .where(and(eq(s.reviewCards.studentId, studentId), lte(s.reviewCards.dueAt, now)))
    .orderBy(s.reviewCards.dueAt);
}

/** Up to n few-shot examples for these misconceptions, teacher-sourced first. */
export async function fewshotFor(misconceptionIds: string[], n = 3) {
  if (!misconceptionIds.length) return [];
  const rows = await db
    .select()
    .from(s.fewshotExamples)
    .where(inArray(s.fewshotExamples.misconceptionId, misconceptionIds))
    .orderBy(sql`case when ${s.fewshotExamples.source} = 'teacher' then 0 else 1 end`, desc(s.fewshotExamples.createdAt))
    .limit(n);
  return rows;
}

export async function teacherFewshotCount() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.fewshotExamples).where(eq(s.fewshotExamples.source, "teacher"));
  return r?.n ?? 0;
}
