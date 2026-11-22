import "server-only";
import { db, schema } from "@/lib/db";
import { generateVerified, bandForElo, BAND_ELO } from "@/lib/agents/generator";
import { poolSize } from "@/lib/repo";

const MIN_POOL = 3; // unseen questions per (student, concept, difficulty band)
const inFlight = new Set<string>();

/**
 * Keep ≥3 verified questions this student hasn't seen per (concept, difficulty band). Runs in the
 * background (via `after()`), never blocks the UI. Generator → verifier → insert as "generated";
 * new questions join the shared bank, so every student benefits. One refill in flight per student.
 */
export async function ensurePool(conceptId: string, targetElo: number, targetMisconceptionId?: string | null, studentId?: string) {
  const band = bandForElo(targetElo);
  const key = `${conceptId}:${band}`;
  const who = studentId ? `student:${studentId}` : null;
  if (inFlight.has(key) || (who && inFlight.has(who))) return;
  inFlight.add(key);
  if (who) inFlight.add(who);
  try {
    const have = await poolSize(conceptId, band, studentId);
    if (have >= MIN_POOL) return;
    const r = await generateVerified({ conceptId, targetElo: BAND_ELO[band], targetMisconceptionId: targetMisconceptionId ?? null });
    if (!r.question) return;
    const q = r.question;
    await db.insert(schema.questions).values({
      conceptId: q.conceptId,
      type: q.type,
      stem: q.stem,
      options: q.type === "MCQ" ? q.options : null,
      answer: q.answer,
      solution: q.solution,
      difficultyElo: BAND_ELO[band],
      source: "generated",
      verified: true,
      targetsMisconceptionId: q.targetsMisconceptionId,
      distractorMisconceptions: q.distractorMisconceptions,
    });
  } catch (e) {
    console.error("[pool] refill failed", e);
  } finally {
    inFlight.delete(key);
    if (who) inFlight.delete(who);
  }
}
