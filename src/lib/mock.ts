import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CONCEPTS, getConcept } from "@/lib/content";
import { answersMatch } from "@/lib/grading";
import { masteryMap, recentQuestionIds, recordAttempt, toPublic } from "@/lib/repo";
import { catMarks } from "@/lib/strategy";
import type { PublicQuestion } from "@/lib/api-types";

const s = schema;

export const MOCK_QUESTIONS = 22;
export const MOCK_MINUTES = 40;
/** CAT QA mix by area (sums to 22). */
const AREA_QUOTA: Record<string, number> = { Arithmetic: 8, Algebra: 6, Geometry: 4, "Number System": 2, "Modern Math": 2 };
const TITA_TARGET = 7; // about a third
const BAND_EDGES = [1180, 1340]; // easy < 1180 ≤ medium < 1340 ≤ hard

type Saved = Record<string, { answer: string | null; marked: boolean; timeSec: number }>;
export interface MockResultItem {
  questionId: string;
  conceptId: string;
  conceptName: string;
  area: string;
  type: "MCQ" | "TITA";
  stem: string;
  options: string[] | null;
  answer: string | null;
  correctAnswer: string;
  solution: string;
  correct: boolean;
  marks: number;
  timeSec: number;
  targetTimeSec: number;
  attemptId: string | null;
  masteryBefore: number | null;
}
export interface MockResults {
  score: number;
  max: number;
  correct: number;
  wrong: number;
  skipped: number;
  negative: number;
  items: MockResultItem[];
  debrief: { lines: string[]; skipGuessGain: number; threshold: number | null; thresholdGain: number };
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const band = (elo: number) => (elo < BAND_EDGES[0] ? 0 : elo < BAND_EDGES[1] ? 1 : 2);

/**
 * Deterministic paper assembly: area quotas, concepts weighted by CAT weight (no concept twice
 * until the area runs out), ~1/3 TITA, a spread of difficulty bands, nothing seen recently.
 */
export async function assemblePaper(studentId: string): Promise<string[]> {
  const [recent, pool] = await Promise.all([
    recentQuestionIds(studentId, 300),
    db.select({ id: s.questions.id, conceptId: s.questions.conceptId, type: s.questions.type, elo: s.questions.difficultyElo }).from(s.questions).where(eq(s.questions.status, "active")),
  ]);
  const seen = new Set(recent);
  const fresh = pool.filter((q) => !seen.has(q.id));
  const usable = fresh.length >= 120 ? fresh : pool; // a heavy user may have seen most of the bank
  const picked: typeof pool = [];
  let tita = 0;
  for (const [area, quota] of Object.entries(AREA_QUOTA)) {
    const concepts = CONCEPTS.filter((c) => c.area === area);
    const bag = shuffle(concepts.flatMap((c) => Array.from({ length: c.weight }, () => c.id))); // weight 3 → 3 tickets
    const used = new Set<string>();
    for (let n = 0; n < quota; n++) {
      const cid = bag.find((c) => !used.has(c)) ?? bag[n % bag.length];
      used.add(cid);
      const wantTita = tita < TITA_TARGET && (picked.length + 1) * TITA_TARGET >= (tita + 1) * MOCK_QUESTIONS;
      const wantBand = picked.length % 3; // cycle easy / medium / hard
      const cands = usable.filter((q) => q.conceptId === cid && !picked.some((p) => p.id === q.id));
      const ranked = shuffle(cands).sort(
        (a, b) => Number(b.type === (wantTita ? "TITA" : "MCQ")) - Number(a.type === (wantTita ? "TITA" : "MCQ")) || Math.abs(band(a.elo) - wantBand) - Math.abs(band(b.elo) - wantBand),
      );
      const q = ranked[0];
      if (!q) continue;
      if (q.type === "TITA") tita++;
      picked.push(q);
    }
  }
  // CAT doesn't group by area: interleave, easier ones a little earlier, TITA spread evenly through the paper
  const ordered = shuffle(picked).sort((a, b) => band(a.elo) - band(b.elo) + (Math.random() - 0.5) * 3.5);
  const titas = ordered.filter((q) => q.type === "TITA");
  const mcqs = ordered.filter((q) => q.type !== "TITA");
  const slots = new Set(titas.map((_, k) => Math.floor(((k + 0.5) * ordered.length) / titas.length)));
  return ordered.map((_, pos) => (slots.has(pos) ? titas.shift() : mcqs.shift()) ?? titas.shift() ?? mcqs.shift()!).map((q) => q.id);
}

async function publicQuestions(ids: string[]): Promise<PublicQuestion[]> {
  const rows = await db.select().from(s.questions).where(inArray(s.questions.id, ids));
  const by = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => by.get(id)).filter((q): q is NonNullable<typeof q> => !!q).map(toPublic);
}

const endsAt = (startedAt: Date) => new Date(startedAt.getTime() + MOCK_MINUTES * 60_000);

/** The in-progress mock (resumable after reload) and the last submitted one. */
export async function getMockState(studentId: string) {
  const rows = await db.select().from(s.mocks).where(eq(s.mocks.studentId, studentId)).orderBy(desc(s.mocks.startedAt)).limit(6);
  const open = rows.find((r) => !r.submittedAt);
  const done = rows.filter((r) => r.submittedAt);
  return {
    active: open
      ? { id: open.id, questions: await publicQuestions(open.questionIds), answers: open.answers as Saved, endsAt: endsAt(open.startedAt).toISOString() }
      : null,
    history: done.map((r) => ({ id: r.id, score: r.score ?? 0, submittedAt: r.submittedAt!.toISOString() })),
    last: done[0]?.results ? { id: done[0].id, results: done[0].results as unknown as MockResults } : null,
  };
}

export async function startMock(studentId: string) {
  const open = await db.select({ id: s.mocks.id }).from(s.mocks).where(and(eq(s.mocks.studentId, studentId), isNull(s.mocks.submittedAt))).limit(1);
  if (open.length) return getMockState(studentId); // never two at once
  const questionIds = await assemblePaper(studentId);
  await db.insert(s.mocks).values({ studentId, questionIds, answers: {} });
  return getMockState(studentId);
}

export async function saveProgress(studentId: string, mockId: string, answers: Saved) {
  const [m] = await db.select().from(s.mocks).where(and(eq(s.mocks.id, mockId), eq(s.mocks.studentId, studentId)));
  if (!m || m.submittedAt) return { ok: false };
  const clean = Object.fromEntries(Object.entries(answers).filter(([k]) => m.questionIds.includes(k)));
  await db.update(s.mocks).set({ answers: clean }).where(eq(s.mocks.id, mockId));
  return { ok: true };
}

/** Grade, run every answered question through the learner model (mode "mock"), and write the debrief. */
export async function submitMock(studentId: string, mockId: string, answers: Saved): Promise<MockResults | null> {
  const [m] = await db.select().from(s.mocks).where(and(eq(s.mocks.id, mockId), eq(s.mocks.studentId, studentId)));
  if (!m) return null;
  if (m.submittedAt && m.results) return m.results as unknown as MockResults;
  // claim the mock first so a double submit can't record attempts twice
  const claimed = await db.update(s.mocks).set({ submittedAt: new Date(), answers }).where(and(eq(s.mocks.id, mockId), isNull(s.mocks.submittedAt))).returning({ id: s.mocks.id });
  if (!claimed.length) return null;

  const mastery = await masteryMap(studentId); // before this mock's answers move it
  const rows = await db.select().from(s.questions).where(inArray(s.questions.id, m.questionIds));
  const by = new Map(rows.map((r) => [r.id, r]));
  const items: MockResultItem[] = [];
  for (const qid of m.questionIds) {
    const q = by.get(qid);
    if (!q) continue;
    const a = answers[qid];
    const given = a?.answer?.trim() ? a.answer.trim() : null;
    const correct = given != null && answersMatch(given, q.answer);
    const c = getConcept(q.conceptId);
    let attemptId: string | null = null;
    if (given != null) {
      const r = await recordAttempt({ studentId, question: q, answer: given, correct, timeSec: Math.max(1, Math.round(a?.timeSec ?? 0)), confidence: null, mode: "mock" });
      attemptId = r.attemptId;
    }
    items.push({
      questionId: qid,
      conceptId: q.conceptId,
      conceptName: c.name,
      area: c.area,
      type: q.type,
      stem: q.stem,
      options: q.options ?? null,
      answer: given,
      correctAnswer: q.answer,
      solution: q.solution,
      correct,
      marks: given == null ? 0 : catMarks(correct, q.type),
      timeSec: Math.round(a?.timeSec ?? 0),
      targetTimeSec: c.target_time_sec,
      attemptId,
      masteryBefore: mastery[q.conceptId] ?? null,
    });
  }
  const results = { ...summarise(items), items, debrief: debrief(items) };
  await db.update(s.mocks).set({ results: results as unknown as Record<string, unknown>, score: results.score }).where(eq(s.mocks.id, mockId));
  return results;
}

function summarise(items: MockResultItem[]) {
  const attempted = items.filter((i) => i.answer != null);
  return {
    score: items.reduce((t, i) => t + i.marks, 0),
    max: items.length * 3,
    correct: attempted.filter((i) => i.correct).length,
    wrong: attempted.filter((i) => !i.correct).length,
    skipped: items.length - attempted.length,
    negative: attempted.filter((i) => !i.correct && i.type === "MCQ").length,
  };
}

/** Skip Coach on this one mock: what skipping weak-concept MCQs would have changed, plus time sinks. */
function debrief(items: MockResultItem[]) {
  const attempted = items.filter((i) => i.answer != null);
  const actual = attempted.reduce((t, i) => t + i.marks, 0);
  // rule: attempt an MCQ only if mastery before the mock was ≥ θ (TITA has no penalty, always attempt)
  let best = { threshold: null as number | null, gain: 0, skipped: 0 };
  for (const th of [0.3, 0.4, 0.5, 0.6]) {
    const kept = attempted.filter((i) => i.type === "TITA" || (i.masteryBefore ?? 0.5) >= th);
    const gain = kept.reduce((t, i) => t + i.marks, 0) - actual;
    if (gain > best.gain) best = { threshold: th, gain, skipped: attempted.length - kept.length };
  }
  const wrongMcq = attempted.filter((i) => !i.correct && i.type === "MCQ");
  const sinks = attempted.filter((i) => !i.correct && i.timeSec > 2 * i.targetTimeSec);
  const lines: string[] = [];
  if (wrongMcq.length) lines.push(`Wrong MCQs cost you ${wrongMcq.length} mark${wrongMcq.length > 1 ? "s" : ""}. A skip would have cost nothing.`);
  if (best.threshold != null && best.gain > 0)
    lines.push(`Skipping the ${best.skipped} MCQ${best.skipped > 1 ? "s" : ""} on concepts below ${Math.round(best.threshold * 100)}% mastery would have scored +${best.gain}.`);
  else if (attempted.length) lines.push("Your attempt choices held up: no mastery cut-off would have beaten this score.");
  if (sinks.length)
    lines.push(`${sinks.length} question${sinks.length > 1 ? "s" : ""} took over twice the target time and still went wrong (${sinks.map((i) => i.conceptName).slice(0, 3).join(", ")}). In the real paper, move on after 2 minutes.`);
  const unanswered = items.length - attempted.length;
  if (unanswered && !lines.length) lines.push(`You left ${unanswered} unanswered, which costs nothing. Good discipline.`);
  return { lines, skipGuessGain: best.gain, threshold: best.threshold, thresholdGain: best.gain };
}
