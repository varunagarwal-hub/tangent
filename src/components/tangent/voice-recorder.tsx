"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toWav16k } from "@/lib/client/wav";
import { cn } from "@/lib/utils";

export type TranscribeMode = "work" | "note";

export interface TranscribeResult {
  text: string;
  lines: string[];
}

/** POST a WAV to /api/transcribe. Throws with a friendly message on failure. */
export async function transcribeAudio(wav: Blob, mode: TranscribeMode): Promise<TranscribeResult> {
  const fd = new FormData();
  fd.append("audio", wav, "voice.wav");
  fd.append("mode", mode);
  const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error ?? "Couldn't transcribe that. Please try again.");
  return data as TranscribeResult;
}

type Phase = "idle" | "recording" | "processing";

/**
 * Record from the microphone. On stop, the clip is converted to 16 kHz WAV and handed to `onAudio`.
 * Keyboard and screen-reader friendly; shows a live timer; stops itself at `maxSec`.
 */
export function useVoiceRecorder({ maxSec = 90, onAudio }: { maxSec?: number; onAudio: (wav: Blob, seconds: number) => Promise<void> | void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = () => rec.current?.stream.getTracks().forEach((t) => t.stop());
  useEffect(() => () => { if (tick.current) clearInterval(tick.current); stopTracks(); }, []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state === "recording") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        if (tick.current) clearInterval(tick.current);
        stream.getTracks().forEach((t) => t.stop());
        const secs = Math.round((Date.now() - started.current) / 1000);
        if (secs < 1) { setPhase("idle"); setError("That was too short. Hold on a little longer."); return; }
        setPhase("processing");
        try {
          const wav = await toWav16k(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
          await onAudio(wav, secs);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong with the recording.");
        } finally {
          setPhase("idle");
        }
      };
      rec.current = mr;
      started.current = Date.now();
      setSeconds(0);
      mr.start();
      setPhase("recording");
      tick.current = setInterval(() => {
        const s = Math.round((Date.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= maxSec) mr.stop();
      }, 250);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to record.");
    }
  }, [maxSec, onAudio]);

  return { phase, seconds, error, start, stop };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A single mic button: tap to record, tap to stop. */
export function VoiceButton({
  onAudio,
  label = "Record",
  processingLabel = "Transcribing…",
  maxSec = 90,
  size = "md",
  className,
}: {
  onAudio: (wav: Blob, seconds: number) => Promise<void> | void;
  label?: string;
  processingLabel?: string;
  maxSec?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const v = useVoiceRecorder({ maxSec, onAudio });
  const recording = v.phase === "recording";
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={recording ? v.stop : v.start}
        disabled={v.phase === "processing"}
        aria-pressed={recording}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border font-medium transition-colors disabled:opacity-60",
          size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2 text-sm",
          recording ? "border-redpen bg-redpen text-white" : "border-ink/25 bg-card text-ink hover:border-redpen hover:text-redpen",
        )}
      >
        {v.phase === "processing" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : recording ? (
          <Square className="size-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="size-4" aria-hidden="true" />
        )}
        {v.phase === "processing" ? processingLabel : recording ? `Stop · ${fmt(v.seconds)}` : label}
        {recording && <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {recording ? "Recording" : v.phase === "processing" ? "Transcribing" : ""}
      </span>
      {v.error && <span className="text-xs text-redpen">{v.error}</span>}
    </span>
  );
}

/** Mic button that transcribes and hands back text (for dictating into a text box). */
export function DictateButton({
  onText,
  mode = "note",
  label = "Dictate",
  size = "sm",
  className,
}: {
  onText: (r: TranscribeResult) => void;
  mode?: TranscribeMode;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <VoiceButton
      size={size}
      className={className}
      label={label}
      onAudio={async (wav) => {
        onText(await transcribeAudio(wav, mode));
      }}
    />
  );
}
