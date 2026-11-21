import { z } from "zod";
import { generateStructured, type ImageInput } from "@/lib/ai/gemini";
import { getMisconception, misconceptionsFor } from "@/lib/content";
import { DIAGNOSE_SYSTEM, TRANSCRIBE_SYSTEM, diagnosePrompt } from "./prompts/detective";
import type { Diagnosis, WorkLine } from "@/lib/api-types";
import type { TraceStep } from "./trace";

/* ── work lines ── */

/** Split typed working into numbered lines (strips "1." / "1)" prefixes the student typed). */
export function toLines(text: string | null | undefined): WorkLine[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+)\s*[.):-]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((t, i) => ({ n: i + 1, text: t.slice(0, 300) }));
}

export function linesToText(lines: WorkLine[]) {
  return lines.map((l) => `${l.n}. ${l.text}`).join("\n");
}

/* ── vision transcription ── */

const TranscriptionOutput = z.object({ lines: z.array(z.string()) });

export async function transcribe(image: ImageInput, studentId?: string | null): Promise<{ lines: WorkLine[]; step: TraceStep }> {
  const t0 = Date.now();
  const { data } = await generateStructured({
    agent: "detective",
    tier: "smart",
    system: TRANSCRIBE_SYSTEM,
    prompt: "Transcribe this rough work, one step per line.",
    images: [image],
    schema: TranscriptionOutput,
    studentId,
    inputSummary: "transcribe rough work image",
    temperature: 0.1,
    thinking: "LOW",
    timeoutMs: 40_000,
  });
  const lines = data.lines.map((t) => t.trim()).filter(Boolean).slice(0, 30).map((text, i) => ({ n: i + 1, text }));
  return {
    lines,
    step: { agent: "detective", summary: `Read your handwriting with Gemini vision: ${lines.length} line${lines.length === 1 ? "" : "s"}`, ms: Date.now() - t0, status: "ok" },
  };
}

/* ── diagnosis ── */

const DiagnoseOutput = z.object({
  reasoning_verdict: z.enum(["sound", "flawed", "unknown"]),
  misconception_id: z.string().describe('A candidate id, or "novel", or "none"'),
  novel_description: z.string().describe("Only when misconception_id is novel; else empty"),
  error_line_number: z.number().int().describe("First wrong line number; 0 if none"),
  error_line_text: z.string(),
  explanation_for_student: z.string(),
  confidence: z.number().min(0).max(1),
});

export interface DiagnoseInput {
  conceptId: string;
  question: string;
  options: string[] | null;
  correctAnswer: string;
  solution: string;
  studentAnswer: string;
  isCorrect: boolean;
  lines: WorkLine[];
  distractorHint?: string | null;
  confidentlyWrong?: boolean;
  studentNote?: string | null;
  examples: { misconception_id: string; work_text: string; source: string }[];
  studentId?: string | null;
}

export async function diagnose(i: DiagnoseInput): Promise<{ diagnosis: Omit<Diagnosis, "lifecycle" | "fewshotFromTeachers">; step: TraceStep }> {
  const t0 = Date.now();
  const candidates = misconceptionsFor(i.conceptId);
  const { data } = await generateStructured({
    agent: "detective",
    tier: "fast",
    system: DIAGNOSE_SYSTEM,
    prompt: diagnosePrompt({
      question: i.question,
      options: i.options,
      correctAnswer: i.correctAnswer,
      solution: i.solution,
      studentAnswer: i.studentAnswer,
      isCorrect: i.isCorrect,
      lines: i.lines,
      candidates,
      examples: i.examples,
      distractorHint: i.distractorHint,
      confidentlyWrong: i.confidentlyWrong,
      studentNote: i.studentNote,
    }),
    schema: DiagnoseOutput,
    studentId: i.studentId,
    inputSummary: `diagnose ${i.conceptId} (${i.isCorrect ? "correct" : "wrong"}, ${i.lines.length} lines)`,
    temperature: 0.2,
    thinking: "LOW",
    timeoutMs: 30_000,
    cache: !i.studentNote,
  });

  const known = getMisconception(data.misconception_id);
  const valid = known && candidates.some((c) => c.id === known.id) ? known : null;
  const novel = data.misconception_id === "novel";
  const lineNo = data.error_line_number > 0 && data.error_line_number <= i.lines.length ? data.error_line_number : null;
  const verdict = data.reasoning_verdict;
  const unsure = data.confidence < 0.5;

  const diagnosis = {
    reasoningVerdict: verdict,
    misconceptionId: verdict === "flawed" && valid && !unsure ? valid.id : null,
    misconceptionName: verdict === "flawed" && valid ? valid.name : null,
    novelDescription: novel && data.novel_description ? data.novel_description : null,
    errorLineNumber: verdict === "flawed" ? lineNo : null,
    errorLineText: verdict === "flawed" && lineNo ? i.lines[lineNo - 1].text : null,
    explanation: unsure
      ? "I'm not sure why this went wrong. Can you tell me your approach?"
      : data.explanation_for_student.trim(),
    confidence: data.confidence,
    unsure,
  };

  const summary =
    verdict === "sound"
      ? i.isCorrect
        ? "Reasoning checks out: back on the curve"
        : "Method looks sound; likely a calculation slip"
      : unsure
        ? `Low confidence (${Math.round(data.confidence * 100)}%): asking the student instead of guessing`
        : valid
          ? `Off on a tangent at line ${lineNo ?? "?"}: ${valid.name} (${Math.round(data.confidence * 100)}% sure)`
          : novel
            ? `New pattern at line ${lineNo ?? "?"}: not in the library yet`
            : "Not enough working to pin down the error";
  return { diagnosis, step: { agent: "detective", summary, ms: Date.now() - t0, status: unsure ? "fallback" : "ok" } };
}
