import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { RIYA_ID } from "@/lib/personas";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import snapshot from "../../../../../data/riya-snapshot.json";

/**
 * "Reset demo": restores Riya's scripted state from data/riya-snapshot.json (written by seed-db),
 * with every timestamp shifted by (now − takenAt), and clears teacher corrections so the
 * "Detective learned" badge is back at 0. One atomic db.batch().
 */
export const maxDuration = 30;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Shift every ISO timestamp string inside a JSON value (fsrs state, mastery history…). */
function shiftJson<T>(v: T, delta: number): T {
  if (typeof v === "string") return (ISO.test(v) ? new Date(Date.parse(v) + delta).toISOString() : v) as T;
  if (Array.isArray(v)) return v.map((x) => shiftJson(x, delta)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftJson(x, delta)])) as T;
  return v;
}

const toDate = (iso: string | null | undefined, delta: number) => (iso ? new Date(Date.parse(iso) + delta) : null);

type Snap = typeof snapshot;

export async function POST() {
  await connection();
  const rl = rateLimit("demo-reset", 6);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const snap = snapshot as Snap;
  const delta = Date.now() - Date.parse(snap.takenAt);
  const st = snap.student;

  const attempts = snap.attempts.map((a) => ({
    ...a,
    reasoningVerdict: a.reasoningVerdict as "sound" | "flawed" | "unknown",
    mode: a.mode as "diagnostic" | "practice" | "review" | "contrast",
    createdAt: toDate(a.createdAt, delta)!,
  }));
  const mastery = snap.mastery.map((m) => ({ ...m, lastSeen: toDate(m.lastSeen, delta), history: shiftJson(m.history, delta) }));
  const events = snap.events.map((e) => ({
    ...e,
    status: e.status as "detected" | "fixing" | "resolved",
    createdAt: toDate(e.createdAt, delta)!,
    updatedAt: toDate(e.updatedAt, delta)!,
  }));
  const cards = snap.cards.map((c) => ({
    ...c,
    itemType: c.itemType as "concept" | "misconception",
    fsrsState: shiftJson(c.fsrsState, delta),
    dueAt: toDate(c.dueAt, delta)!,
  }));
  const feedback = (snap.feedback as Array<Record<string, unknown>>).map((f) => ({
    ...(f as unknown as typeof s.feedback.$inferInsert),
    createdAt: toDate(f.createdAt as string, delta)!,
  }));

  try {
    const ops = [
      // Deleting the student cascades to attempts (→ feedback), mastery, misconception events and review cards.
      db.delete(s.students).where(eq(s.students.id, RIYA_ID)),
      db.delete(s.feedback).where(eq(s.feedback.byRole, "teacher")),
      db.delete(s.fewshotExamples).where(eq(s.fewshotExamples.source, "teacher")),
      db.insert(s.students).values({
        ...st,
        role: st.role as "student" | "teacher",
        persona: st.persona as Record<string, unknown> | null,
        createdAt: toDate(st.createdAt, delta)!,
      }),
      ...(attempts.length ? [db.insert(s.attempts).values(attempts)] : []),
      ...(mastery.length ? [db.insert(s.mastery).values(mastery)] : []),
      ...(events.length ? [db.insert(s.misconceptionEvents).values(events)] : []),
      ...(cards.length ? [db.insert(s.reviewCards).values(cards)] : []),
      ...(feedback.length ? [db.insert(s.feedback).values(feedback)] : []),
    ] as const;
    await db.batch(ops as unknown as Parameters<typeof db.batch>[0]);
  } catch (e) {
    console.error("demo reset failed", e);
    return Response.json({ error: "Couldn't reset the demo. Try again in a moment." }, { status: 500 });
  }

  return Response.json({ ok: true, attempts: attempts.length, due: cards.filter((c) => c.dueAt.getTime() <= Date.now()).length });
}
