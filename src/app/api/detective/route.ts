import { rateLimit, tooMany } from "@/lib/rate-limit";
import { connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getStudentId } from "@/lib/session";
import { applyDiagnosis, fewshotFor, getQuestion, teacherFewshotCount } from "@/lib/repo";
import { diagnose, linesToText, toLines, transcribe } from "@/lib/agents/detective";
import { getMisconception, misconceptionsFor } from "@/lib/content";
import { answersMatch } from "@/lib/grading";
import { uploadRoughWork } from "@/lib/storage";
import type { DetectiveEvent, Diagnosis, TraceStep, WorkLine } from "@/lib/api-types";

export const maxDuration = 60;

const Body = z.object({
  attemptId: z.string().uuid(),
  work: z
    .object({
      text: z.string().max(4000).optional(),
      imageDataUrl: z.string().max(7_000_000).optional(),
      source: z.enum(["type", "scratchpad", "upload", "sample", "none"]),
    })
    .optional(),
  /** student-confirmed transcription ("Here's what I read") */
  confirmedLines: z.array(z.object({ n: z.number().int(), text: z.string().max(300) })).max(30).optional(),
  /** skip the transcription-confirm step */
  quick: z.boolean().optional(),
  /** "That's not why I got it wrong": the student's own explanation */
  studentNote: z.string().max(600).optional(),
});

function parseDataUrl(url: string) {
  const m = url.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const studentId = await getStudentId();
  const rl = rateLimit(`detective:${studentId}`, 20);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const [att] = await db
    .select()
    .from(schema.attempts)
    .where(and(eq(schema.attempts.id, b.attemptId), eq(schema.attempts.studentId, studentId)));
  if (!att) return Response.json({ error: "attempt not found" }, { status: 404 });
  const q = att.questionId ? await getQuestion(att.questionId) : null;
  if (!q) return Response.json({ error: "question not found" }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: DetectiveEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const trace: TraceStep[] = [];
      const step = (s: TraceStep) => {
        trace.push(s);
        send({ type: "step", step: s });
      };

      const distractorHint =
        !att.isCorrect && q.type === "MCQ"
          ? ((q.distractorMisconceptions ?? []).find((d) => answersMatch(d.option, att.answer ?? ""))?.misconception_id ?? null)
          : null;

      try {
        // 1) Lines: confirmed transcription > image (vision) > typed text
        let lines: WorkLine[] = b.confirmedLines?.filter((l) => l.text.trim()).map((l, i) => ({ n: i + 1, text: l.text.trim() })) ?? [];
        let transcription: string | null = null;
        let imageUrl: string | null = null;
        const img = b.work?.imageDataUrl ? parseDataUrl(b.work.imageDataUrl) : null;

        if (!lines.length && img) {
          const blob = new Blob([Buffer.from(img.data, "base64")], { type: img.mimeType });
          const [up, tr] = await Promise.allSettled([uploadRoughWork(blob, studentId), transcribe(img, studentId)]);
          imageUrl = up.status === "fulfilled" ? up.value : null;
          if (imageUrl) await db.update(schema.attempts).set({ workImageUrl: imageUrl }).where(eq(schema.attempts.id, att.id));
          if (tr.status === "rejected") throw new Error("vision transcription failed");
          lines = tr.value.lines;
          transcription = linesToText(lines);
          step(tr.value.step);
          send({ type: "transcription", lines });
          if (!b.quick) {
            controller.close(); // client shows "Here's what I read", then calls again with confirmedLines
            return;
          }
        }
        if (!lines.length) lines = toLines(b.work?.text ?? att.workText);
        if (b.confirmedLines?.length) transcription = linesToText(lines);

        // 2) Few-shot examples: the hinted misconception first, teacher-labelled first
        const candidateIds = misconceptionsFor(q.conceptId).map((m) => m.id);
        const ordered = distractorHint ? [distractorHint, ...candidateIds.filter((x) => x !== distractorHint)] : candidateIds;
        const examples = await fewshotFor(ordered.slice(0, 4), 3);
        const teacherCount = await teacherFewshotCount();
        if (distractorHint) {
          step({ agent: "detective", summary: `Your option matches a known trap: ${getMisconception(distractorHint)?.name}`, ms: 0, status: "ok" });
        }

        // 3) Diagnose
        let diag: Omit<Diagnosis, "lifecycle" | "fewshotFromTeachers">;
        try {
          const r = await diagnose({
            conceptId: q.conceptId,
            question: q.stem,
            options: q.options ?? null,
            correctAnswer: q.answer,
            solution: q.solution,
            studentAnswer: att.answer ?? "",
            isCorrect: att.isCorrect,
            lines,
            distractorHint,
            confidentlyWrong: (att.diagnosis as { confidentlyWrong?: boolean } | null)?.confidentlyWrong,
            studentNote: b.studentNote ?? null,
            examples: examples.map((e) => ({ misconception_id: e.misconceptionId, work_text: e.workText, source: e.source })),
            studentId,
          });
          diag = r.diagnosis;
          step(r.step);
        } catch (err) {
          console.error("[detective] diagnose failed", err);
          // Deterministic fallback: the tagged distractor tells us the misconception.
          const m = getMisconception(distractorHint);
          diag = {
            reasoningVerdict: m ? "flawed" : "unknown",
            misconceptionId: m?.id ?? null,
            misconceptionName: m?.name ?? null,
            novelDescription: null,
            errorLineNumber: null,
            errorLineText: null,
            explanation: m ? m.description : "I couldn't read the reasoning this time. Can you tell me your approach?",
            confidence: m ? 0.6 : 0,
            unsure: !m,
          };
          step({ agent: "detective", summary: m ? "AI timed out, so I used the trap you fell into" : "AI unavailable, so I'm asking you instead", ms: 0, status: "fallback" });
        }

        // 4) Persist + lifecycle
        const { lifecycle } = await applyDiagnosis({
          attemptId: att.id,
          studentId,
          verdict: diag.reasoningVerdict,
          misconceptionId: diag.misconceptionId,
          errorLine: diag.errorLineText,
          transcription,
          workText: b.work?.text?.trim() || (transcription ?? undefined),
          workImageUrl: imageUrl,
          diagnosis: { ...diag, studentNote: b.studentNote ?? null },
          trace,
        });
        if (lifecycle) {
          const label = lifecycle === "resolved" ? "Back on the curve: misconception resolved 🎉" : lifecycle === "fixing" ? "Misconception is being fixed" : "Logged in your Mistake Journal";
          step({ agent: "learner_model", summary: label, ms: 0, status: "ok" });
        }
        if (b.studentNote) {
          await db.insert(schema.feedback).values({
            attemptId: att.id,
            byRole: "student",
            kind: "disagree_diagnosis",
            note: b.studentNote,
            correctedMisconceptionId: diag.misconceptionId,
          });
        }

        send({ type: "diagnosis", diagnosis: { ...diag, lifecycle, fewshotFromTeachers: teacherCount }, lines });
      } catch (err) {
        console.error("[detective]", err);
        send({ type: "error", message: "The detective couldn't read this one. Your answer is still graded and saved." });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
