import "server-only";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMisconception } from "@/lib/content";
import { CLASS_ID } from "@/lib/personas";

const s = schema;
const GRACE_MS = 2 * 3600_000; // a class stays "upcoming" until 2 hours after it starts

export interface DoubtClass {
  id: string;
  title: string;
  misconceptionId: string | null;
  startsAt: string;
  link: string | null;
  students: { id: string; name: string }[];
}

/** Students in the class with this misconception still open (detected or fixing). */
async function studentsWith(misconceptionId: string, classId: string) {
  const rows = await db
    .selectDistinct({ id: s.students.id })
    .from(s.misconceptionEvents)
    .innerJoin(s.students, eq(s.students.id, s.misconceptionEvents.studentId))
    .where(and(eq(s.misconceptionEvents.misconceptionId, misconceptionId), inArray(s.misconceptionEvents.status, ["detected", "fixing"]), eq(s.students.classId, classId), eq(s.students.role, "student")));
  return rows.map((r) => r.id);
}

async function studentsNamed(names: string[], classId: string) {
  if (!names.length) return [];
  const rows = await db
    .select({ id: s.students.id })
    .from(s.students)
    .where(and(eq(s.students.classId, classId), eq(s.students.role, "student"), inArray(s.students.name, names)));
  return rows.map((r) => r.id);
}

export async function scheduleDoubtClass(input: { misconceptionId?: string | null; studentNames?: string[]; title?: string; startsAt: Date; link?: string | null; classId?: string }) {
  const classId = input.classId ?? CLASS_ID;
  const m = input.misconceptionId ? getMisconception(input.misconceptionId) : null;
  const ids = [...new Set([...(m ? await studentsWith(m.id, classId) : []), ...(await studentsNamed(input.studentNames ?? [], classId))])];
  if (!ids.length) return { error: m ? "No students to invite: nobody in the class has this open right now." : "No students to invite: none of those names are in the class." };
  const [row] = await db
    .insert(s.doubtClasses)
    .values({
      classId,
      misconceptionId: m?.id ?? null,
      title: (input.title?.trim() || (m ? `Doubt class: ${m.name}` : "Doubt class")).slice(0, 120),
      startsAt: input.startsAt,
      link: input.link?.trim() || null,
      studentIds: ids,
    })
    .returning({ id: s.doubtClasses.id });
  return { id: row.id, invited: ids.length };
}

async function withNames(rows: (typeof s.doubtClasses.$inferSelect)[]): Promise<DoubtClass[]> {
  const ids = [...new Set(rows.flatMap((r) => r.studentIds))];
  const names = ids.length ? await db.select({ id: s.students.id, name: s.students.name }).from(s.students).where(inArray(s.students.id, ids)) : [];
  const byId = new Map(names.map((n) => [n.id, n.name]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    misconceptionId: r.misconceptionId,
    startsAt: r.startsAt.toISOString(),
    link: r.link,
    students: r.studentIds.filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id)! })),
  }));
}

/** Upcoming classes for the teacher's class, soonest first. */
export async function upcomingForClass(classId = CLASS_ID, now = new Date()) {
  const rows = await db
    .select()
    .from(s.doubtClasses)
    .where(and(eq(s.doubtClasses.classId, classId), gte(s.doubtClasses.startsAt, new Date(now.getTime() - GRACE_MS))))
    .orderBy(asc(s.doubtClasses.startsAt));
  return withNames(rows);
}

/** Upcoming classes this student is invited to. */
export async function upcomingForStudent(studentId: string, now = new Date()) {
  const rows = await db
    .select()
    .from(s.doubtClasses)
    .where(and(gte(s.doubtClasses.startsAt, new Date(now.getTime() - GRACE_MS)), sql`${s.doubtClasses.studentIds} @> ${JSON.stringify([studentId])}::jsonb`))
    .orderBy(asc(s.doubtClasses.startsAt));
  return rows.map((r) => ({ id: r.id, title: r.title, startsAt: r.startsAt.toISOString(), link: r.link, invited: r.studentIds.length }));
}

export async function cancelDoubtClass(id: string, classId = CLASS_ID) {
  await db.delete(s.doubtClasses).where(and(eq(s.doubtClasses.id, id), eq(s.doubtClasses.classId, classId)));
}
