import { connection } from "next/server";
import { z } from "zod";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";
import { createQuery, studentQueries } from "@/lib/queries";
import { AudioRejected, assertValidAudio, transcribeVoice, uploadVoice } from "@/lib/voice";

export const maxDuration = 60;

/** The current student's questions to their teacher, with replies. */
export async function GET() {
  await connection();
  return Response.json({ queries: await studentQueries(await getStudentId()) });
}

const Meta = z.object({
  text: z.string().max(2000).optional(),
  questionId: z.string().uuid().optional(),
  attemptId: z.string().uuid().optional(),
  conceptId: z.string().max(8).optional(),
});

/** POST multipart { text?, audio? (WAV), questionId?, attemptId?, conceptId? }: ask the teacher. */
export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`query:${studentId}`, 10);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "bad request" }, { status: 400 });
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const meta = Meta.safeParse({ text: str("text"), questionId: str("questionId"), attemptId: str("attemptId"), conceptId: str("conceptId") });
  if (!meta.success) return Response.json({ error: "bad request" }, { status: 400 });
  const audio = form.get("audio");
  let text = meta.data.text ?? "";
  let audioUrl: string | null = null;
  const viaVoice = audio instanceof Blob;
  try {
    if (audio instanceof Blob) {
      assertValidAudio(audio);
      const [t, url] = await Promise.all([text ? Promise.resolve(null) : transcribeVoice(audio, "note", studentId), uploadVoice(audio, "queries", studentId)]);
      if (t) text = t.text;
      audioUrl = url;
    }
  } catch (e) {
    if (e instanceof AudioRejected) return Response.json({ error: e.message }, { status: 400 });
    console.error("[queries] voice", e);
    if (!text) return Response.json({ error: "Couldn't transcribe that. Please try again or type your question." }, { status: 502 });
  }
  if (!text) return Response.json({ error: "Type or record your question first." }, { status: 400 });
  const { questionId, attemptId, conceptId } = meta.data;
  const q = await createQuery({ studentId, text, audioUrl, viaVoice, questionId, attemptId, conceptId });
  return Response.json({ query: q });
}
