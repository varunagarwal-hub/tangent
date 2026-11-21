import { connection } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getPersona } from "@/lib/session";
import { replyToQuery } from "@/lib/queries";
import { AudioRejected, assertValidAudio, transcribeVoice, uploadVoice } from "@/lib/voice";

export const maxDuration = 60;

/** POST multipart { text?, audio? (WAV) }: the teacher replies by text or voice. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const persona = await getPersona();
  const rl = rateLimit(`reply:${persona.id}`, 20);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "bad request" }, { status: 400 });
  const t = form.get("text");
  let text = typeof t === "string" ? t.trim().slice(0, 4000) : "";
  const audio = form.get("audio");
  let audioUrl: string | null = null;
  try {
    if (audio instanceof Blob) {
      assertValidAudio(audio);
      const [tr, url] = await Promise.all([text ? Promise.resolve(null) : transcribeVoice(audio, "note"), uploadVoice(audio, "replies", persona.id)]);
      if (tr) text = tr.text;
      audioUrl = url;
    }
  } catch (e) {
    if (e instanceof AudioRejected) return Response.json({ error: e.message }, { status: 400 });
    console.error("[reply] voice", e);
    if (!text) return Response.json({ error: "Couldn't transcribe that. Please try again or type your reply." }, { status: 502 });
  }
  if (!text) return Response.json({ error: "Type or record a reply first." }, { status: 400 });
  const q = await replyToQuery(id, { text, audioUrl, viaVoice: audio instanceof Blob });
  return q ? Response.json({ query: q }) : Response.json({ error: "not found" }, { status: 404 });
}
