import "server-only";
import { put } from "@vercel/blob";
import { z } from "zod";
import { generateStructured, hasGemini } from "@/lib/ai/gemini";
import { hasBlobStorage, toBase64 } from "@/lib/storage";

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export class AudioRejected extends Error {}

export function assertValidAudio(file: Blob) {
  if (!["audio/wav", "audio/x-wav", "audio/wave"].includes(file.type)) throw new AudioRejected("Unsupported audio type");
  if (file.size > MAX_AUDIO_BYTES) throw new AudioRejected("Recording is too long (max about 2 minutes)");
  if (file.size < 2000) throw new AudioRejected("Recording is empty");
}

const WorkOut = z.object({
  lines: z.array(z.string()).max(30).describe("The student's spoken reasoning as numbered working steps, one step per item, in order. Keep their numbers and operations exactly as said, including mistakes. Write maths compactly, e.g. '20% + 10% = 30%'."),
});
const NoteOut = z.object({
  text: z.string().max(4000).describe("A clean transcript of what was said, lightly punctuated. Keep the speaker's meaning and any maths exactly."),
});

/**
 * Transcribe a 16 kHz WAV with Gemini Flash.
 * mode "work": spoken rough work → numbered steps for the Detective (mistakes kept, never corrected).
 * mode "note": a teacher's feedback or a student's question → a clean transcript.
 */
export async function transcribeVoice(audio: Blob, mode: "work" | "note", studentId?: string | null): Promise<{ text: string; lines: string[] }> {
  if (!hasGemini()) throw new Error("Transcription is unavailable right now");
  const data = await toBase64(audio);
  if (mode === "work") {
    const { data: out } = await generateStructured({
      agent: "detective",
      tier: "fast",
      system:
        "You transcribe a CAT Quant student thinking aloud while solving a problem (Indian English, may mix Hindi words). Turn what they say into their working steps, one step per line, in order. Keep every number and operation exactly as they said it, including mistakes: never fix, add or skip steps. Drop filler words. If nothing mathematical was said, return an empty list.",
      prompt: "Transcribe this recording into working steps.",
      images: [{ data, mimeType: "audio/wav" }],
      schema: WorkOut,
      studentId,
      inputSummary: "transcribe spoken rough work",
      thinking: "LOW",
      timeoutMs: 25_000,
    });
    const lines = out.lines.map((l) => l.trim()).filter(Boolean);
    return { lines, text: lines.join("\n") };
  }
  const { data: out } = await generateStructured({
    agent: "coach",
    tier: "fast",
    system:
      "Transcribe this voice note from a CAT Quant teacher or student (Indian English, may mix Hindi words; translate any Hindi into English). Return a clean, lightly punctuated transcript. Keep maths and meaning exactly; drop filler words.",
    prompt: "Transcribe this voice note.",
    images: [{ data, mimeType: "audio/wav" }],
    schema: NoteOut,
    studentId,
    inputSummary: "transcribe voice note",
    thinking: "LOW",
    timeoutMs: 25_000,
  });
  return { text: out.text.trim(), lines: [] };
}

/** Store a voice note in Vercel Blob so the other side can play it. Null if storage is unavailable. */
export async function uploadVoice(audio: Blob, folder: "queries" | "replies", ownerId: string): Promise<string | null> {
  if (!hasBlobStorage()) return null;
  const safe = ownerId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "anon";
  try {
    const blob = await put(`voice/${folder}/${safe}/${Date.now()}.wav`, audio, { access: "public", contentType: "audio/wav", addRandomSuffix: true });
    return blob.url;
  } catch (err) {
    console.error("[voice] upload failed", err);
    return null;
  }
}
