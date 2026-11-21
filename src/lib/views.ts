import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CONCEPTS, getConcept, getMisconception } from "@/lib/content";
import * as L from "@/lib/learner";
import { activeMisconceptions, dueCards, getMasteryRows } from "@/lib/repo";
import type { ConceptDetail, MapData } from "@/lib/api-types";

const s = schema;

async function conceptCards(studentId: string) {
  const cards = await db
    .select()
    .from(s.reviewCards)
    .where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "concept")));
  return new Map(cards.map((c) => [c.itemId, c]));
}

export async function getMapData(studentId: string, now = new Date()): Promise<MapData> {
  const [rows, cards, active] = await Promise.all([getMasteryRows(studentId), conceptCards(studentId), activeMisconceptions(studentId)]);
  const byConcept = new Map(rows.map((r) => [r.conceptId, r]));
  const activeConcepts = new Set(active.map((e) => getMisconception(e.misconceptionId)?.concept_id).filter(Boolean));
  const nodes = CONCEPTS.map((c) => {
    const r = byConcept.get(c.id);
    const card = cards.get(c.id);
    const stored = (card?.fsrsState as L.StoredCard) ?? null;
    return {
      conceptId: c.id,
      name: c.name,
      area: c.area,
      prerequisites: c.prerequisites,
      weight: c.weight,
      p: r ? r.pMastery : null,
      attempts: r?.attempts ?? 0,
      opacity: r ? L.fadeOpacity(stored, now) : 1,
      retrievability: r ? L.retrievability(stored, now) : 1,
      dueAt: card ? new Date(card.dueAt).toISOString() : null,
      hasActiveMisconception: activeConcepts.has(c.id),
    };
  });
  const edges = CONCEPTS.flatMap((c) => c.prerequisites.map((p) => ({ from: p, to: c.id })));
  return { nodes, edges };
}

export async function getConceptDetail(studentId: string, conceptId: string, now = new Date()): Promise<ConceptDetail> {
  const c = getConcept(conceptId);
  const [rows, cards, attempts, events] = await Promise.all([
    getMasteryRows(studentId),
    conceptCards(studentId),
    db
      .select()
      .from(s.attempts)
      .where(and(eq(s.attempts.studentId, studentId), eq(s.attempts.conceptId, conceptId)))
      .orderBy(desc(s.attempts.createdAt))
      .limit(12),
    db.select().from(s.misconceptionEvents).where(eq(s.misconceptionEvents.studentId, studentId)),
  ]);
  const row = rows.find((r) => r.conceptId === conceptId);
  const map = Object.fromEntries(rows.map((r) => [r.conceptId, r.pMastery]));
  const card = cards.get(conceptId);
  const stored = (card?.fsrsState as L.StoredCard) ?? null;

  // Forgetting curve: retrievability for each of the next 30 days, assuming no review.
  const forgetting = Array.from({ length: 31 }, (_, day) => ({
    day,
    r: +L.retrievability(stored, new Date(now.getTime() + day * 86_400_000)).toFixed(3),
  }));

  return {
    conceptId,
    name: c.name,
    area: c.area,
    weight: c.weight,
    targetTimeSec: c.target_time_sec,
    p: row?.pMastery ?? null,
    attempts: row?.attempts ?? 0,
    avgTimeRatio: row?.avgTimeRatio ?? null,
    history: row?.history ?? [],
    recentAttempts: attempts.map((a) => ({
      at: new Date(a.createdAt).toISOString(),
      correct: a.isCorrect,
      timeSec: a.timeSec,
      misconceptionName: getMisconception(a.misconceptionId)?.name ?? null,
      verdict: a.reasoningVerdict,
    })),
    misconceptions: events
      .filter((e) => getMisconception(e.misconceptionId)?.concept_id === conceptId)
      .map((e) => ({ id: e.misconceptionId, name: getMisconception(e.misconceptionId)!.name, status: e.status, evidenceCount: e.evidenceCount })),
    forgetting,
    dueAt: card ? new Date(card.dueAt).toISOString() : null,
    prerequisites: c.prerequisites.map((id) => ({ id, name: getConcept(id).name, p: map[id] ?? null })),
  };
}

/* ── Today ─────────────────────────────────────────────────────────────── */

export async function getTodayData(studentId: string, now = new Date()) {
  const [student] = await db.select().from(s.students).where(eq(s.students.id, studentId));
  const [rows, due, events] = await Promise.all([
    getMasteryRows(studentId),
    dueCards(studentId, now),
    db
      .select()
      .from(s.misconceptionEvents)
      .where(eq(s.misconceptionEvents.studentId, studentId))
      .orderBy(desc(s.misconceptionEvents.updatedAt)),
  ]);
  const byArea = new Map<string, { sum: number; n: number; tested: number }>();
  for (const c of CONCEPTS) {
    const r = rows.find((x) => x.conceptId === c.id);
    const a = byArea.get(c.area) ?? { sum: 0, n: 0, tested: 0 };
    a.n += 1;
    if (r) {
      a.sum += r.pMastery;
      a.tested += 1;
    }
    byArea.set(c.area, a);
  }
  const examDate = student?.examDate ? new Date(student.examDate) : null;
  const daysToCat = examDate ? Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / 86_400_000)) : null;
  return {
    name: student?.name ?? "there",
    streak: student?.streakDays ?? 0,
    daysToCat,
    dailyMinutes: student?.dailyMinutes ?? 60,
    dueConcepts: due.filter((d) => d.itemType === "concept").map((d) => ({ id: d.itemId, name: getConcept(d.itemId).name })),
    dueMisconceptions: due.filter((d) => d.itemType === "misconception").length,
    areas: [...byArea].map(([area, a]) => ({ area, mastery: a.tested ? a.sum / a.tested : null, tested: a.tested, total: a.n })),
    journal: events.slice(0, 4).map((e) => ({
      id: e.misconceptionId,
      name: getMisconception(e.misconceptionId)?.name ?? e.misconceptionId,
      concept: getConcept(getMisconception(e.misconceptionId)?.concept_id ?? "A1").name,
      status: e.status,
      evidenceCount: e.evidenceCount,
    })),
    attemptsTotal: rows.reduce((a, r) => a + r.attempts, 0),
    isNew: rows.length === 0,
  };
}

/* ── Mistake Journal ───────────────────────────────────────────────────── */

export async function getMistakeJournal(studentId: string) {
  const events = await db
    .select()
    .from(s.misconceptionEvents)
    .where(eq(s.misconceptionEvents.studentId, studentId))
    .orderBy(desc(s.misconceptionEvents.updatedAt));
  const attempts = await db
    .select({
      misconceptionId: s.attempts.misconceptionId,
      errorLine: s.attempts.errorLine,
      workText: s.attempts.workText,
      createdAt: s.attempts.createdAt,
      diagnosis: s.attempts.diagnosis,
    })
    .from(s.attempts)
    .where(eq(s.attempts.studentId, studentId))
    .orderBy(desc(s.attempts.createdAt))
    .limit(200);
  return events.map((e) => {
    const m = getMisconception(e.misconceptionId);
    const last = attempts.find((a) => a.misconceptionId === e.misconceptionId);
    const explanation = (last?.diagnosis as { explanation?: string } | null)?.explanation ?? null;
    return {
      id: e.misconceptionId,
      name: m?.name ?? e.misconceptionId,
      description: m?.description ?? "",
      conceptId: m?.concept_id ?? "",
      conceptName: m ? getConcept(m.concept_id).name : "",
      status: e.status,
      evidenceCount: e.evidenceCount,
      cleanCount: e.cleanCount,
      firstSeen: new Date(e.createdAt).toISOString(),
      updatedAt: new Date(e.updatedAt).toISOString(),
      lastErrorLine: last?.errorLine && last.errorLine !== "see work" ? last.errorLine : null,
      lastExplanation: explanation,
      example: m?.wrong_reasoning_example ?? null,
    };
  });
}
export type JournalEntry = Awaited<ReturnType<typeof getMistakeJournal>>[number];
export type TodayData = Awaited<ReturnType<typeof getTodayData>>;
