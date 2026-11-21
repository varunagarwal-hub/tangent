import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AREAS, CONCEPTS, getConcept, getMisconception, misconceptionsFor } from "@/lib/content";
import { CLASS_ID } from "@/lib/personas";
import { teacherFewshotCount } from "@/lib/repo";
import type { AssignmentRow, OverrideItem, StudentDrilldown, TeacherClassData } from "@/lib/api-types";

const s = schema;
const DAY = 86_400_000;
const LOW_CONFIDENCE = 0.6;

async function classStudents(classId = CLASS_ID) {
  return db
    .select()
    .from(s.students)
    .where(and(eq(s.students.classId, classId), eq(s.students.role, "student")))
    .orderBy(s.students.name);
}

export async function classMasteryByConcept(studentIds: string[]) {
  if (!studentIds.length) return new Map<string, number>();
  const rows = await db
    .select({ conceptId: s.mastery.conceptId, avg: sql<number>`avg(${s.mastery.pMastery})::float` })
    .from(s.mastery)
    .where(inArray(s.mastery.studentId, studentIds))
    .groupBy(s.mastery.conceptId);
  return new Map(rows.map((r) => [r.conceptId, r.avg]));
}

export async function getClassData(classId = CLASS_ID, now = new Date()): Promise<TeacherClassData> {
  const [cls] = await db.select().from(s.classes).where(eq(s.classes.id, classId));
  const students = await classStudents(classId);
  const ids = students.map((x) => x.id);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);

  const [mastery, events, lastActive, trendRows, queueRows, assignments, teacherCorrections] = await Promise.all([
    db.select().from(s.mastery).where(inArray(s.mastery.studentId, ids)),
    db.select().from(s.misconceptionEvents).where(inArray(s.misconceptionEvents.studentId, ids)),
    db
      .select({ studentId: s.attempts.studentId, last: sql<string>`max(${s.attempts.createdAt})`, n: sql<number>`count(*)::int` })
      .from(s.attempts)
      .where(inArray(s.attempts.studentId, ids))
      .groupBy(s.attempts.studentId),
    db
      .select({
        misconceptionId: s.attempts.misconceptionId,
        thisWeek: sql<number>`count(*) filter (where ${s.attempts.createdAt} >= ${weekAgo.toISOString()})::int`,
        lastWeek: sql<number>`count(*) filter (where ${s.attempts.createdAt} < ${weekAgo.toISOString()})::int`,
      })
      .from(s.attempts)
      .where(and(inArray(s.attempts.studentId, ids), isNotNull(s.attempts.misconceptionId), gte(s.attempts.createdAt, twoWeeksAgo)))
      .groupBy(s.attempts.misconceptionId),
    db
      .select()
      .from(s.attempts)
      .where(
        and(
          inArray(s.attempts.studentId, ids),
          isNotNull(s.attempts.misconceptionId),
          isNotNull(s.attempts.workText),
          sql`coalesce((${s.attempts.diagnosis}->>'confidence')::float, 1) < ${LOW_CONFIDENCE}`,
          sql`coalesce(${s.attempts.diagnosis}->>'teacherReviewed', 'false') <> 'true'`,
        ),
      )
      .orderBy(desc(s.attempts.createdAt))
      .limit(12),
    db.select().from(s.assignments).where(eq(s.assignments.classId, classId)).orderBy(desc(s.assignments.createdAt)),
    teacherFewshotCount(),
  ]);

  // heatmap
  const heat: Record<string, Record<string, number | null>> = {};
  for (const st of students) heat[st.id] = Object.fromEntries(CONCEPTS.map((c) => [c.id, null]));
  for (const m of mastery) heat[m.studentId][m.conceptId] = m.pMastery;
  const conceptAvg: Record<string, number | null> = {};
  for (const c of CONCEPTS) {
    const vals = students.map((st) => heat[st.id][c.id]).filter((v): v is number => v != null);
    conceptAvg[c.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  // students + risk
  const activeByStudent = new Map<string, number>();
  for (const e of events) if (e.status !== "resolved") activeByStudent.set(e.studentId, (activeByStudent.get(e.studentId) ?? 0) + 1);
  const lastBy = new Map(lastActive.map((r) => [r.studentId, r]));
  // "many active misconceptions" is relative to this class: top fifth, and at least 5
  const sortedActive = students.map((st) => activeByStudent.get(st.id) ?? 0).sort((a, b) => a - b);
  const activeCut = Math.max(5, sortedActive[Math.floor(sortedActive.length * 0.8)] ?? 5);
  const studentRows = students.map((st) => {
    const ps = Object.values(heat[st.id]).filter((v): v is number => v != null);
    const avg = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
    const act = activeByStudent.get(st.id) ?? 0;
    const last = lastBy.get(st.id)?.last ?? null;
    const idleDays = last ? Math.floor((now.getTime() - new Date(last).getTime()) / DAY) : null;
    const reasons: string[] = [];
    if (avg != null && avg < 0.38) reasons.push(`avg mastery ${Math.round(avg * 100)}%`);
    if (act >= activeCut) reasons.push(`${act} active misconceptions (top fifth of class)`);
    if (idleDays != null && idleDays >= 6) reasons.push(`inactive ${idleDays} days`);
    return {
      id: st.id,
      name: st.name,
      archetype: ((st.persona as { archetype?: string } | null)?.archetype as string) ?? null,
      avgMastery: avg,
      attempts: lastBy.get(st.id)?.n ?? 0,
      activeMisconceptions: act,
      atRisk: reasons.length > 0,
      riskReasons: reasons,
      lastActive: last ? new Date(last).toISOString() : null,
    };
  });

  // leaderboard
  const activeCount = new Map<string, number>();
  for (const e of events) if (e.status !== "resolved") activeCount.set(e.misconceptionId, (activeCount.get(e.misconceptionId) ?? 0) + 1);
  const trend = new Map(trendRows.map((r) => [r.misconceptionId!, r]));
  const leaderboard = [...activeCount]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n]) => {
      const m = getMisconception(id)!;
      return {
        misconceptionId: id,
        name: m?.name ?? id,
        conceptId: m?.concept_id ?? "",
        conceptName: m ? getConcept(m.concept_id).name : "",
        students: n,
        pctClass: students.length ? n / students.length : 0,
        trend: { thisWeek: trend.get(id)?.thisWeek ?? 0, lastWeek: trend.get(id)?.lastWeek ?? 0 },
      };
    });

  // override queue
  const nameById = new Map(students.map((x) => [x.id, x.name]));
  const qIds = queueRows.map((a) => a.questionId).filter((x): x is string => !!x);
  const qs = qIds.length ? await db.select({ id: s.questions.id, stem: s.questions.stem }).from(s.questions).where(inArray(s.questions.id, qIds)) : [];
  const stemById = new Map(qs.map((q) => [q.id, q.stem]));
  const overrideQueue: OverrideItem[] = queueRows.map((a) => {
    const m = getMisconception(a.misconceptionId);
    return {
      attemptId: a.id,
      studentId: a.studentId,
      studentName: nameById.get(a.studentId) ?? "Student",
      conceptId: a.conceptId,
      conceptName: getConcept(a.conceptId).name,
      questionStem: (a.questionId && stemById.get(a.questionId)) || "",
      studentAnswer: a.answer,
      workText: a.workText,
      errorLine: a.errorLine && a.errorLine !== "see work" ? a.errorLine : null,
      misconceptionId: a.misconceptionId,
      misconceptionName: m?.name ?? null,
      confidence: (a.diagnosis as { confidence?: number } | null)?.confidence ?? null,
      createdAt: new Date(a.createdAt).toISOString(),
      candidates: misconceptionsFor(a.conceptId).map((x) => ({ id: x.id, name: x.name })),
    };
  });

  // assignments with impact
  const avgNow = await classMasteryByConcept(ids);
  const assignmentRows: AssignmentRow[] = assignments.map((a) => {
    const current = avgNow.get(a.conceptId) ?? null;
    return {
      id: a.id,
      conceptId: a.conceptId,
      conceptName: getConcept(a.conceptId).name,
      createdAt: new Date(a.createdAt).toISOString(),
      questionCount: a.questionIds.length,
      baseline: a.baselineMastery,
      current,
      lift: current != null && a.baselineMastery != null ? current - a.baselineMastery : null,
    };
  });

  const tested = studentRows.map((r) => r.avgMastery).filter((v): v is number => v != null);
  return {
    class: { id: classId, name: cls?.name ?? "Class" },
    kpis: {
      students: students.length,
      avgMastery: tested.length ? tested.reduce((a, b) => a + b, 0) / tested.length : null,
      activeMisconceptions: [...activeCount.values()].reduce((a, b) => a + b, 0),
      atRisk: studentRows.filter((r) => r.atRisk).length,
    },
    concepts: CONCEPTS.map((c) => ({ id: c.id, name: c.name, area: c.area, weight: c.weight })),
    students: studentRows,
    heat,
    conceptAvg,
    leaderboard,
    overrideQueue,
    assignments: assignmentRows,
    teacherCorrections,
  };
}

export async function getStudentDrilldown(studentId: string): Promise<StudentDrilldown | null> {
  const [st] = await db.select().from(s.students).where(eq(s.students.id, studentId));
  if (!st) return null;
  const [mastery, events, attempts] = await Promise.all([
    db.select().from(s.mastery).where(eq(s.mastery.studentId, studentId)),
    db.select().from(s.misconceptionEvents).where(eq(s.misconceptionEvents.studentId, studentId)),
    db.select().from(s.attempts).where(eq(s.attempts.studentId, studentId)).orderBy(desc(s.attempts.createdAt)).limit(10),
  ]);
  const byArea = AREAS.map((area) => {
    const ps = mastery.filter((m) => getConcept(m.conceptId).area === area).map((m) => m.pMastery);
    return { area, mastery: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null };
  });
  const tested = mastery.filter((m) => m.attempts > 0);
  const calib = tested.length ? tested.reduce((a, m) => a + m.calibration, 0) / tested.length : null;
  return {
    id: st.id,
    name: st.name,
    archetype: ((st.persona as { archetype?: string } | null)?.archetype as string) ?? null,
    targetPercentile: st.targetPercentile,
    streakDays: st.streakDays,
    calibrationGap: calib,
    areas: byArea,
    weakest: [...mastery]
      .sort((a, b) => a.pMastery - b.pMastery)
      .slice(0, 5)
      .map((m) => ({ conceptId: m.conceptId, name: getConcept(m.conceptId).name, p: m.pMastery })),
    misconceptions: events
      .sort((a, b) => b.evidenceCount - a.evidenceCount)
      .map((e) => ({ id: e.misconceptionId, name: getMisconception(e.misconceptionId)?.name ?? e.misconceptionId, status: e.status, evidenceCount: e.evidenceCount })),
    recentAttempts: attempts.map((a) => ({
      at: new Date(a.createdAt).toISOString(),
      conceptName: getConcept(a.conceptId).name,
      correct: a.isCorrect,
      timeSec: a.timeSec,
      misconceptionName: getMisconception(a.misconceptionId)?.name ?? null,
    })),
  };
}

/**
 * Teacher confirms or relabels a diagnosis. Either way the work becomes a teacher-labelled
 * few-shot example, which the detective prefers for future cases (feedback loop 8).
 */
export async function relabelAttempt(input: { attemptId: string; action: "confirm" | "relabel"; misconceptionId?: string; note?: string }) {
  const [att] = await db.select().from(s.attempts).where(eq(s.attempts.id, input.attemptId));
  if (!att) return { ok: false as const, error: "attempt not found" };
  const target = input.action === "confirm" ? att.misconceptionId : input.misconceptionId;
  const m = getMisconception(target);
  if (!m) return { ok: false as const, error: "unknown misconception" };

  const prev = (att.diagnosis ?? {}) as Record<string, unknown>;
  await Promise.all([
    db
      .update(s.attempts)
      .set({
        misconceptionId: m.id,
        reasoningVerdict: "flawed",
        diagnosis: { ...prev, teacherReviewed: true, teacherLabel: m.id, previousLabel: att.misconceptionId, confidence: 1 },
      })
      .where(eq(s.attempts.id, att.id)),
    db.insert(s.feedback).values({
      attemptId: att.id,
      byRole: "teacher",
      kind: "teacher_relabel",
      note: input.note ?? (input.action === "confirm" ? "confirmed" : null),
      correctedMisconceptionId: m.id,
    }),
    att.workText
      ? db.insert(s.fewshotExamples).values({ misconceptionId: m.id, workText: att.workText, source: "teacher" })
      : Promise.resolve(),
  ]);

  // keep the student's lifecycle honest when the label changes
  if (input.action === "relabel" && att.misconceptionId && att.misconceptionId !== m.id) {
    const [old] = await db
      .select()
      .from(s.misconceptionEvents)
      .where(and(eq(s.misconceptionEvents.studentId, att.studentId), eq(s.misconceptionEvents.misconceptionId, att.misconceptionId)));
    if (old && old.evidenceCount <= 1) {
      await db.delete(s.misconceptionEvents).where(eq(s.misconceptionEvents.id, old.id));
    } else if (old) {
      await db.update(s.misconceptionEvents).set({ evidenceCount: old.evidenceCount - 1 }).where(eq(s.misconceptionEvents.id, old.id));
    }
    await db
      .insert(s.misconceptionEvents)
      .values({ studentId: att.studentId, misconceptionId: m.id, status: "detected", evidenceCount: 1, cleanCount: 0 })
      .onConflictDoUpdate({
        target: [s.misconceptionEvents.studentId, s.misconceptionEvents.misconceptionId],
        set: { evidenceCount: sql`${s.misconceptionEvents.evidenceCount} + 1`, updatedAt: new Date() },
      });
  }
  return { ok: true as const, teacherCorrections: await teacherFewshotCount() };
}

/** Assign ~10 bank questions on a concept (plus its prerequisites if short), storing the baseline (loop 9). */
export async function createAssignment(conceptId: string, classId = CLASS_ID): Promise<AssignmentRow> {
  const c = getConcept(conceptId);
  const pool = await db
    .select({ id: s.questions.id, conceptId: s.questions.conceptId })
    .from(s.questions)
    .where(and(inArray(s.questions.conceptId, [c.id, ...c.prerequisites]), eq(s.questions.status, "active")));
  const ordered = [...pool.filter((q) => q.conceptId === c.id), ...pool.filter((q) => q.conceptId !== c.id)].slice(0, 10);
  const ids = (await classStudents(classId)).map((x) => x.id);
  const baseline = (await classMasteryByConcept(ids)).get(c.id) ?? null;
  const [row] = await db
    .insert(s.assignments)
    .values({ classId, conceptId: c.id, questionIds: ordered.map((q) => q.id), baselineMastery: baseline })
    .returning();
  return {
    id: row.id,
    conceptId: c.id,
    conceptName: c.name,
    createdAt: new Date(row.createdAt).toISOString(),
    questionCount: ordered.length,
    baseline,
    current: baseline,
    lift: 0,
  };
}
