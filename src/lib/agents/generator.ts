import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { getConcept, getMisconception, misconceptionsFor } from "@/lib/content";
import { GENERATOR_SYSTEM, generatorPrompt } from "./prompts/generator";
import { verifyQuestion, type DraftQuestion } from "./verifier";
import type { TraceStep } from "./trace";

export const GeneratorOutput = z.object({
  type: z.enum(["MCQ", "TITA"]),
  stem: z.string(),
  options: z.array(z.string()).describe("Exactly 4 for MCQ; empty for TITA"),
  answer: z.string(),
  solution: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  distractor_misconceptions: z
    .array(z.object({ option: z.string(), misconception_id: z.string() }))
    .describe("Wrong MCQ options tagged with the misconception that produces them; empty for TITA"),
});

export type Band = "easy" | "medium" | "hard";
export const BAND_ELO: Record<Band, number> = { easy: 1050, medium: 1250, hard: 1450 };

export function bandForElo(elo: number): Band {
  return elo < 1150 ? "easy" : elo < 1350 ? "medium" : "hard";
}

export interface GeneratedQuestion extends DraftQuestion {
  conceptId: string;
  solution: string;
  difficultyElo: number;
  targetsMisconceptionId: string | null;
  distractorMisconceptions: { option: string; misconception_id: string }[];
}

export interface GenerateRequest {
  conceptId: string;
  targetElo: number;
  type?: "MCQ" | "TITA";
  targetMisconceptionId?: string | null;
  avoidStems?: string[];
  /** optional scenario or problem style (bank building) */
  theme?: string;
  studentId?: string | null;
}

/** One generator call (no verification). */
export async function draftQuestion(req: GenerateRequest, retryReason?: string): Promise<GeneratedQuestion> {
  const concept = getConcept(req.conceptId);
  const mcs = misconceptionsFor(concept.id);
  const target = getMisconception(req.targetMisconceptionId);
  const band = bandForElo(req.targetElo);
  const type = req.type ?? (target ? "MCQ" : "MCQ");

  const { data } = await generateStructured({
    agent: "generator",
    tier: "fast",
    system: GENERATOR_SYSTEM,
    prompt: generatorPrompt({
      conceptId: concept.id,
      conceptName: concept.name,
      area: concept.area,
      band,
      type,
      targetTimeSec: concept.target_time_sec,
      target,
      misconceptions: mcs.map((m) => ({ id: m.id, name: m.name })),
      avoidStems: req.avoidStems,
      theme: req.theme,
      retryReason,
    }),
    schema: GeneratorOutput,
    studentId: req.studentId,
    inputSummary: `generate ${concept.id} ${band}${target ? ` → ${target.id}` : ""}`,
    temperature: 0.9,
    cache: false,
    timeoutMs: 45_000,
    thinking: "LOW", // ~6s vs >45s at default; the verifier re-solves every draft anyway
  });

  const validIds = new Set(mcs.map((m) => m.id));
  return {
    conceptId: concept.id,
    type: data.type,
    stem: data.stem.trim(),
    options: data.type === "MCQ" ? data.options.map((o) => o.trim()) : [],
    answer: data.answer.trim(),
    solution: data.solution.trim(),
    difficultyElo: BAND_ELO[data.difficulty] ?? req.targetElo,
    targetsMisconceptionId: target?.id ?? null,
    distractorMisconceptions: data.distractor_misconceptions.filter((d) => validIds.has(d.misconception_id)),
  };
}

export interface VerifiedResult {
  question: GeneratedQuestion | null;
  trace: TraceStep[];
  rejections: string[];
}

/**
 * Generator ↔ verifier loop: draft, verify independently, and on rejection retry
 * (max 2 retries) feeding the rejection reason back to the generator.
 * Returns question = null when all drafts fail; callers fall back to the bank.
 */
export async function generateVerified(req: GenerateRequest, maxRetries = 2): Promise<VerifiedResult> {
  const trace: TraceStep[] = [];
  const rejections: string[] = [];
  let retryReason: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const t0 = Date.now();
    let draft: GeneratedQuestion;
    try {
      draft = await draftQuestion(req, retryReason);
      trace.push({
        agent: "generator",
        summary: `Drafted a ${bandForElo(draft.difficultyElo)} ${draft.type} on ${getConcept(req.conceptId).name}${draft.targetsMisconceptionId ? " (contrast)" : ""}${attempt ? ` — retry ${attempt}` : ""}`,
        ms: Date.now() - t0,
        status: "ok",
      });
    } catch (err) {
      trace.push({ agent: "generator", summary: "Generator failed", ms: Date.now() - t0, status: "error" });
      rejections.push(`generator error: ${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`);
      continue;
    }

    const v = await verifyQuestion(draft, { studentId: req.studentId });
    trace.push(v.step);
    if (v.ok) return { question: draft, trace, rejections };
    rejections.push(v.reason);
    retryReason = v.reason;
  }

  if (rejections.length) {
    trace.push({
      agent: "verifier",
      summary: `Verifier rejected ${rejections.length} draft${rejections.length > 1 ? "s" : ""}, using a bank question instead`,
      ms: 0,
      status: "fallback",
    });
  }
  return { question: null, trace, rejections };
}
