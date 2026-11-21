import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getConcept } from "@/lib/content";
import { CLASS_ID } from "@/lib/personas";

const s = schema;

export interface StudentQuery {
  id: string;
  studentId: string;
  studentName: string;
  conceptName: string | null;
  questionStem: string | null;
  text: string;
  audioUrl: string | null;
  viaVoice: boolean;
  status: "open" | "answered";
  replyText: string | null;
  replyAudioUrl: string | null;
  replyViaVoice: boolean;
  createdAt: string;
  repliedAt: string | null;
}

async function hydrate(rows: (typeof s.studentQueries.$inferSelect)[]): Promise<StudentQuery[]> {
  if (!rows.length) return [];
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const questionIds = [...new Set(rows.map((r) => r.questionId).filter((x): x is string => !!x))];
  const [people, qs] = await Promise.all([
    db.select({ id: s.students.id, name: s.students.name }).from(s.students).where(inArray(s.students.id, studentIds)),
    questionIds.length ? db.select({ id: s.questions.id, stem: s.questions.stem }).from(s.questions).where(inArray(s.questions.id, questionIds)) : Promise.resolve([]),
  ]);
  const name = new Map(people.map((p) => [p.id, p.name]));
  const stem = new Map(qs.map((q) => [q.id, q.stem]));
  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentName: name.get(r.studentId) ?? "Student",
    conceptName: r.conceptId ? (getConcept(r.conceptId)?.name ?? null) : null,
    questionStem: r.questionId ? (stem.get(r.questionId) ?? null) : null,
    text: r.text,
    audioUrl: r.audioUrl,
    viaVoice: r.viaVoice,
    status: r.status,
    replyText: r.replyText,
    replyAudioUrl: r.replyAudioUrl,
    replyViaVoice: r.replyViaVoice,
    createdAt: new Date(r.createdAt).toISOString(),
    repliedAt: r.repliedAt ? new Date(r.repliedAt).toISOString() : null,
  }));
}

export async function createQuery(input: {
  studentId: string;
  text: string;
  audioUrl: string | null;
  viaVoice: boolean;
  questionId?: string | null;
  attemptId?: string | null;
  conceptId?: string | null;
}) {
  const [stu] = await db.select({ classId: s.students.classId }).from(s.students).where(eq(s.students.id, input.studentId));
  const [row] = await db
    .insert(s.studentQueries)
    .values({
      studentId: input.studentId,
      classId: stu?.classId ?? CLASS_ID,
      questionId: input.questionId ?? null,
      attemptId: input.attemptId ?? null,
      conceptId: input.conceptId ?? null,
      text: input.text,
      audioUrl: input.audioUrl,
      viaVoice: input.viaVoice,
    })
    .returning();
  return (await hydrate([row]))[0];
}

export async function studentQueries(studentId: string, limit = 20) {
  const rows = await db.select().from(s.studentQueries).where(eq(s.studentQueries.studentId, studentId)).orderBy(desc(s.studentQueries.createdAt)).limit(limit);
  return hydrate(rows);
}

/** Teacher inbox: open questions first (newest first), then the latest answered ones. */
export async function classQueries(classId = CLASS_ID) {
  const [open, answered] = await Promise.all([
    db.select().from(s.studentQueries).where(and(eq(s.studentQueries.classId, classId), eq(s.studentQueries.status, "open"))).orderBy(desc(s.studentQueries.createdAt)).limit(50),
    db.select().from(s.studentQueries).where(and(eq(s.studentQueries.classId, classId), eq(s.studentQueries.status, "answered"))).orderBy(desc(s.studentQueries.repliedAt)).limit(10),
  ]);
  return hydrate([...open, ...answered]);
}

export async function replyToQuery(id: string, reply: { text: string; audioUrl: string | null; viaVoice: boolean }) {
  const [row] = await db
    .update(s.studentQueries)
    .set({ status: "answered", replyText: reply.text, replyAudioUrl: reply.audioUrl, replyViaVoice: reply.viaVoice, repliedAt: new Date() })
    .where(eq(s.studentQueries.id, id))
    .returning();
  return row ? (await hydrate([row]))[0] : null;
}
