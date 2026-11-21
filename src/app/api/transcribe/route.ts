import { connection } from "next/server";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getPersona } from "@/lib/session";
import { AudioRejected, assertValidAudio, transcribeVoice } from "@/lib/voice";

export const maxDuration = 60;

/** POST multipart { audio: WAV, mode: "work" | "note" } → { text, lines } */
export async function POST(req: Request) {
  await connection();
  const persona = await getPersona();
  const rl = rateLimit(`transcribe:${persona.id}`, 20);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const mode = form?.get("mode") === "work" ? "work" : "note";
  if (!(audio instanceof Blob)) return Response.json({ error: "No recording received" }, { status: 400 });
  try {
    assertValidAudio(audio);
    const out = await transcribeVoice(audio, mode, persona.role === "student" ? persona.id : null);
    if (!out.text) return Response.json({ error: "I couldn't hear any words. Try again a little closer to the mic." }, { status: 422 });
    return Response.json(out);
  } catch (e) {
    if (e instanceof AudioRejected) return Response.json({ error: e.message }, { status: 400 });
    console.error("[transcribe]", e);
    return Response.json({ error: "Couldn't transcribe that just now. Please try again or type it." }, { status: 502 });
  }
}
