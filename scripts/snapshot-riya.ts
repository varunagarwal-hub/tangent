/**
 * Exports Riya's scripted demo state → data/riya-snapshot.json, so POST /api/demo/reset
 * can restore it without re-running the whole seed.
 *   npx tsx scripts/snapshot-riya.ts      (seed-db.ts runs this automatically at the end)
 *
 * Timestamps are stored as-is with `takenAt`; the reset route shifts every date by (now − takenAt),
 * so "4 reviews due", "6-day streak" and "first seen 3 days ago" stay true whenever it's restored.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { writeFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";

export async function snapshotRiya(out = "data/riya-snapshot.json") {
  const { getDb } = await import("../src/lib/db/client");
  const s = await import("../src/lib/db/schema");
  const { RIYA_ID } = await import("../src/lib/personas");
  const db = getDb();

  const [student] = await db.select().from(s.students).where(eq(s.students.id, RIYA_ID));
  if (!student) throw new Error("Riya not found: run scripts/seed-db.ts first");
  const attempts = await db.select().from(s.attempts).where(eq(s.attempts.studentId, RIYA_ID));
  const mastery = await db.select().from(s.mastery).where(eq(s.mastery.studentId, RIYA_ID));
  const events = await db.select().from(s.misconceptionEvents).where(eq(s.misconceptionEvents.studentId, RIYA_ID));
  const cards = await db.select().from(s.reviewCards).where(eq(s.reviewCards.studentId, RIYA_ID));
  const feedback = attempts.length
    ? await db.select().from(s.feedback).where(inArray(s.feedback.attemptId, attempts.map((a) => a.id)))
    : [];

  const snap = { takenAt: new Date().toISOString(), student, attempts, mastery, events, cards, feedback };
  writeFileSync(out, JSON.stringify(snap));
  console.log(
    `Riya snapshot → ${out}: ${attempts.length} attempts, ${mastery.length} mastery, ${events.length} misconception events, ${cards.length} review cards, ${feedback.length} feedback`,
  );
}

// Run directly (not when imported by seed-db).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/snapshot-riya.ts")) {
  snapshotRiya().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
