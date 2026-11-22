import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { istDayStart } from "@/lib/games";
import { activeMisconceptions, dueCards } from "@/lib/repo";

const s = schema;

export interface ChecklistItem {
  id: "reviews" | "contrast" | "game";
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

/** YYYY-MM-DD of a moment in India time. */
export function istDate(d: Date) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Consecutive IST days (ending today, or yesterday if nothing yet today) with at least one
 * attempt or game. The seeded `students.streak_days` is a floor so Riya's demo story holds.
 */
export async function computeStreak(studentId: string, floor: number, now = new Date()) {
  const res = await db.execute(sql`
    select distinct to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d from attempts
      where student_id = ${studentId} and created_at > now() - interval '400 days'
    union
    select distinct to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d from game_scores
      where student_id = ${studentId} and created_at > now() - interval '400 days'`);
  const days = new Set(((res as unknown as { rows: { d: string }[] }).rows ?? []).map((r) => r.d));
  const today = istDate(now);
  const activeToday = days.has(today);
  let streak = 0;
  for (let k = activeToday ? 0 : 1; k < 400; k++) {
    if (days.has(istDate(new Date(now.getTime() - k * 86_400_000)))) streak++;
    else break;
  }
  return { streak: Math.max(streak, floor), activeToday };
}

/** Today's three-item ritual, computed from today's activity (IST day). */
export async function getDailyChecklist(studentId: string, now = new Date()) {
  const since = istDayStart(now);
  const [due, active, [contrastToday], [anyToday], [gamesToday], [student]] = await Promise.all([
    dueCards(studentId, now),
    activeMisconceptions(studentId),
    db.select({ n: count() }).from(s.attempts).where(and(eq(s.attempts.studentId, studentId), eq(s.attempts.mode, "contrast"), gte(s.attempts.createdAt, since))),
    db.select({ n: count() }).from(s.attempts).where(and(eq(s.attempts.studentId, studentId), gte(s.attempts.createdAt, since))),
    db.select({ n: count() }).from(s.gameScores).where(and(eq(s.gameScores.studentId, studentId), gte(s.gameScores.createdAt, since))),
    db.select({ streakDays: s.students.streakDays }).from(s.students).where(eq(s.students.id, studentId)),
  ]);
  const { streak, activeToday } = await computeStreak(studentId, student?.streakDays ?? 0, now);

  const items: ChecklistItem[] = [
    {
      id: "reviews",
      label: "Clear your due reviews",
      detail: due.length ? `${due.length} due now` : "Nothing left due",
      href: "/practice?mode=review",
      done: due.length === 0,
    },
    active.length
      ? {
          id: "contrast",
          label: "One question on an open tangent",
          detail: contrastToday.n ? "Done: a contrast question today" : "A question built to catch your own mistake",
          href: "/practice",
          done: contrastToday.n > 0,
        }
      : {
          id: "contrast",
          label: "Answer one practice question",
          detail: anyToday.n ? "Done today" : "No open tangents, so any question counts",
          href: "/practice",
          done: anyToday.n > 0,
        },
    {
      id: "game",
      label: "One sprint or Spot the Tangent",
      detail: gamesToday.n ? `${gamesToday.n} game${gamesToday.n > 1 ? "s" : ""} today` : "Five minutes, keeps you sharp",
      href: "/play",
      done: gamesToday.n > 0,
    },
  ];
  return { items, done: items.filter((i) => i.done).length, streak, activeToday, today: istDate(now) };
}

export type DailyChecklist = Awaited<ReturnType<typeof getDailyChecklist>>;
