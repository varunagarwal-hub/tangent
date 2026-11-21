import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { answersMatch } from "@/lib/grading";
import { VERIFIER_SYSTEM, verifierPrompt } from "./prompts/verifier";
import type { TraceStep } from "./trace";

export const VerifierOutput = z.object({
  working: z.string().describe("Your step-by-step solution"),
  answer: z.string().describe("Final answer: exact option text for MCQ, bare number for TITA"),
  ambiguous: z.boolean(),
  issues: z.string(),
});

export interface DraftQuestion {
  type: "MCQ" | "TITA";
  stem: string;
  options: string[];
  answer: string;
}

export type VerifyResult =
  | { ok: true; step: TraceStep }
  | { ok: false; reason: string; step: TraceStep };

/** Cheap structural checks before spending a model call. */
export function structuralProblem(q: DraftQuestion): string | null {
  if (q.stem.trim().length < 20) return "stem too short";
  if (q.type === "MCQ") {
    if (q.options.length !== 4) return `MCQ needs 4 options, got ${q.options.length}`;
    const norm = q.options.map((o) => o.trim().toLowerCase());
    if (new Set(norm).size !== 4) return "duplicate options";
    if (!q.options.some((o) => answersMatch(o, q.answer))) return "answer key is not one of the options";
    if (q.options.filter((o) => answersMatch(o, q.answer)).length > 1) return "more than one option equals the answer";
  } else {
    if (q.options.length) return "TITA must not have options";
    if (!/^-?\d+(\.\d+)?$/.test(q.answer.replace(/,/g, "").trim())) return "TITA answer must be a bare number";
  }
  return null;
}

/**
 * Solves the question independently (smart model, no answer key) and compares.
 * Rejects on mismatch or ambiguity.
 */
export async function verifyQuestion(q: DraftQuestion, opts: { studentId?: string | null } = {}): Promise<VerifyResult> {
  const started = Date.now();
  const structural = structuralProblem(q);
  if (structural) {
    return { ok: false, reason: structural, step: { agent: "verifier", summary: `Verifier rejected draft: ${structural}`, ms: Date.now() - started, status: "rejected" } };
  }
  try {
    const { data } = await generateStructured({
      agent: "verifier",
      tier: "smart",
      system: VERIFIER_SYSTEM,
      prompt: verifierPrompt(q),
      schema: VerifierOutput,
      studentId: opts.studentId,
      inputSummary: `verify: ${q.stem.slice(0, 120)}`,
      temperature: 0.1,
      timeoutMs: 90_000, // full thinking: accuracy matters more than speed here (runs in the background)
    });
    const ms = Date.now() - started;
    if (data.ambiguous) {
      const reason = `ambiguous${data.issues ? ` (${data.issues.slice(0, 120)})` : ""}`;
      return { ok: false, reason, step: { agent: "verifier", summary: `Verifier rejected draft: ${reason}`, ms, status: "rejected" } };
    }
    if (!answersMatch(data.answer, q.answer)) {
      const reason = `answer mismatch (key says ${q.answer}, independent solve got ${data.answer})`;
      return { ok: false, reason, step: { agent: "verifier", summary: "Verifier rejected draft: answer mismatch", ms, status: "rejected" } };
    }
    return { ok: true, step: { agent: "verifier", summary: "Verifier solved it independently: answer matches", ms, status: "ok" } };
  } catch (err) {
    const reason = "verifier unavailable";
    console.error("[verifier]", err);
    return { ok: false, reason, step: { agent: "verifier", summary: "Verifier unavailable, draft not used", ms: Date.now() - started, status: "error" } };
  }
}
