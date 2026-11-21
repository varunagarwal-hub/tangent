import { connection } from "next/server";
import { z } from "zod";
import { grade, answersMatch } from "@/lib/grading";
import { getQuestion, recordAttempt, creditCleanCorrect } from "@/lib/repo";
import { getStudentId } from "@/lib/session";
import { getConcept } from "@/lib/content";
import type { SubmitResponse, TraceStep } from "@/lib/api-types";

const Body = z.object({
  questionId: z.string().uuid(),
  answer: z.string().max(200),
  timeSec: z.number().int().min(0).max(3600),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  mode: z.enum(["diagnostic", "practice", "review", "contrast"]),
  work: z
    .object({
      text: z.string().max(4000).optional(),
      imageDataUrl: z.string().max(7_000_000).optional(),
      source: z.enum(["type", "scratchpad", "upload", "sample", "none"]),
    })
    .optional(),
});

/** Instant grading + learner-model update. No AI on this path. */
export async function POST(req: Request) {
  await connection();
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  const studentId = await getStudentId();
  const q = await getQuestion(b.questionId);
  if (!q) return Response.json({ error: "question not found" }, { status: 404 });

  const correct = grade(q, b.answer);
  const hasWork = Boolean(b.work?.text?.trim() || b.work?.imageDataUrl);
  const rec = await recordAttempt({
    studentId,
    question: q,
    answer: b.answer,
    correct,
    timeSec: b.timeSec,
    confidence: b.confidence,
    mode: b.mode,
    workText: b.work?.text?.trim() || null,
  });

  // Contrast question answered correctly without work: avoiding the planted distractor counts as clean evidence.
  if (correct && !hasWork && b.mode === "contrast") await creditCleanCorrect(studentId, q.conceptId);

  const chosenTag =
    !correct && q.type === "MCQ"
      ? ((q.distractorMisconceptions ?? []).find((d) => answersMatch(d.option, b.answer))?.misconception_id ?? null)
      : null;

  const c = getConcept(q.conceptId);
  const pct = (x: number) => Math.round(x * 100);
  const trace: TraceStep[] = [
    {
      agent: "learner_model",
      summary: `${correct ? "Correct" : "Incorrect"} in ${b.timeSec}s (target ${c.target_time_sec}s). ${c.name} mastery ${pct(rec.before)}% → ${pct(rec.after)}%, review: ${rec.rating}`,
      ms: Date.now() - started,
      status: "ok",
    },
  ];

  const res: SubmitResponse = {
    attemptId: rec.attemptId,
    correct,
    correctAnswer: q.answer,
    solution: q.solution,
    conceptId: q.conceptId,
    masteryBefore: rec.before,
    masteryAfter: rec.after,
    needsDiagnosis: !correct || hasWork,
    distractorMisconceptionId: chosenTag,
    trace,
  };
  return Response.json(res);
}
