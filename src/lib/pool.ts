import "server-only";
import { db, schema } from "@/lib/db";
import { generateVerified, bandForElo, BAND_ELO } from "@/lib/agents/generator";
import { poolSize } from "@/lib/repo";

const MIN_POOL = 3;
const inFlight = new Set<string>();

/**
 * Keep ≥3 verified questions per (concept, difficulty band). Runs in the background
 * (via `after()`), never blocks the UI. Generator → verifier → insert as "generated".
 */
export async function ensurePool(conceptId: string, targetElo: number, targetMisconceptionId?: string | null) {
  const band = bandForElo(targetElo);
  const key = `${conceptId}:${band}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    const have = await poolSize(conceptId, band);
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
  }
}
