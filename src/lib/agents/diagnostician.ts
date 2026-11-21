import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { CONCEPTS, getConcept } from "@/lib/content";
import * as L from "@/lib/learner";

export const DIAGNOSTIC_LENGTH = 12;

/** Roots first, by weight: the opening probes of the adaptive diagnostic. */
const OPENERS = CONCEPTS.filter((c) => c.prerequisites.length === 0)
  .sort((a, b) => b.weight - a.weight)
  .map((c) => c.id);

/**
 * Deterministic next-concept choice:
 * 1. after a miss, step down to an untested prerequisite of that concept
 * 2. otherwise the first unasked high-weight root (A1, A2, A3, L3 …) for the first 4
 * 3. otherwise the most uncertain concept: weight × closeness of p to 0.5, untested first-class
 */
export function nextDiagnosticConcept(asked: { conceptId: string; correct: boolean }[], mastery: Record<string, number>) {
  const askedIds = new Set(asked.map((a) => a.conceptId));
  const last = asked[asked.length - 1];
  if (last && !last.correct) {
    const pre = getConcept(last.conceptId).prerequisites.find((p) => !askedIds.has(p));
    if (pre) return { conceptId: pre, reason: `Missed ${getConcept(last.conceptId).name}, so checking its foundation, ${getConcept(pre).name}` };
  }
  if (asked.length < 4) {
    const opener = OPENERS.find((id) => !askedIds.has(id) && getConcept(id).weight === 3);
    if (opener) return { conceptId: opener, reason: `Opening probe on a high-weight root concept: ${getConcept(opener).name}` };
  }
  let best: { id: string; score: number } | null = null;
  for (const c of CONCEPTS) {
    if (askedIds.has(c.id)) continue;
    const p = mastery[c.id] ?? L.priorFromPrereqs(c.prerequisites.map((x) => mastery[x]).filter((v): v is number => v != null));
    const uncertainty = 1 - Math.abs(p - 0.5) * 2; // 1 at p = 0.5
    // after a correct answer, dependents of the last concept become more informative
    const unlock = last?.correct && c.prerequisites.includes(last.conceptId) ? 0.4 : 0;
    const score = c.weight * (uncertainty + unlock);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  const id = best?.id ?? OPENERS[0];
  return { conceptId: id, reason: `Most uncertain high-value concept now: ${getConcept(id).name}` };
}

const SummaryOutput = z.object({ summary: z.string() });

/** Gemini writes only the final summary paragraph. */
export async function diagnosticSummary(input: {
  studentId: string;
  results: { conceptId: string; correct: boolean }[];
  mastery: Record<string, number>;
  misconceptions: string[];
}) {
  const strong = Object.entries(input.mastery).filter(([, p]) => p > 0.7).map(([id]) => getConcept(id).name);
  const weak = Object.entries(input.mastery).filter(([, p]) => p < 0.4).map(([id]) => getConcept(id).name);
  const fallback = `You got ${input.results.filter((r) => r.correct).length} of ${input.results.length} right. ${strong.length ? `Strong on ${strong.slice(0, 3).join(", ")}. ` : ""}${weak.length ? `We'll start by shoring up ${weak.slice(0, 3).join(", ")}.` : "Let's build from here."}`;
  try {
    const { data } = await generateStructured({
      agent: "diagnostician",
      tier: "fast",
      system:
        "You are a warm CAT Quant mentor (Indian English). Write a 2–3 sentence summary of a diagnostic: what's strong, what's shaky, the single most important misconception to fix, and what happens next. Use 'you'. Never predict a percentile.",
      prompt: `Score: ${input.results.filter((r) => r.correct).length}/${input.results.length}\nStrong: ${strong.join(", ") || "none yet"}\nWeak: ${weak.join(", ") || "none"}\nMisconceptions detected: ${input.misconceptions.join(", ") || "none"}`,
      schema: SummaryOutput,
      studentId: input.studentId,
      inputSummary: "diagnostic summary",
      thinking: "LOW",
      timeoutMs: 10_000,
    });
    return data.summary.trim();
  } catch {
    return fallback;
  }
}
