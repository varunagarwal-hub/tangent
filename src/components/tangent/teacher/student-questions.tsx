"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDot, Mic, Send } from "lucide-react";
import type { StudentQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MathText } from "@/components/tangent/math-text";
import { DictateButton, VoiceButton } from "@/components/tangent/voice-recorder";
import { cn } from "@/lib/utils";
import { fetchJson } from "./shared";

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function VoiceNote({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        <Mic className="size-3.5" aria-hidden="true" /> {label}
      </span>
      <audio controls preload="none" src={src} className="h-9 w-full max-w-sm" aria-label={label} />
    </div>
  );
}

function StatusChip({ status }: { status: StudentQuery["status"] }) {
  const open = status === "open";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        open ? "border-redpen/50 bg-redpen/10 text-redpen" : "border-mastery-high/50 bg-mastery-high/10 text-mastery-high",
      )}
    >
      {open ? <CircleDot className="size-3" aria-hidden="true" /> : <CheckCircle2 className="size-3" aria-hidden="true" />}
      {open ? "Open" : "Answered"}
    </span>
  );
}

async function sendReply(id: string, text: string, audio?: Blob): Promise<StudentQuery> {
  const fd = new FormData();
  if (text.trim()) fd.append("text", text.trim());
  if (audio) fd.append("audio", audio, "voice.wav");
  const res = await fetch(`/api/teacher/queries/${id}/reply`, { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.query) throw new Error(data?.error ?? "Couldn't send the reply. Please try again.");
  return data.query as StudentQuery;
}

function QueryCard({ q, onUpdated }: { q: StudentQuery; onUpdated: (q: StudentQuery) => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = q.status === "open";

  const submit = async (audio?: Blob) => {
    if (!audio && !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onUpdated(await sendReply(q.id, reply, audio));
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="paper-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {q.studentName}
            <span className="ml-2 text-sm font-normal text-ink-soft">{timeAgo(q.createdAt)}</span>
          </p>
          {q.conceptName && <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{q.conceptName}</p>}
        </div>
        <StatusChip status={q.status} />
      </div>

      {q.questionStem && (
        <div className="line-clamp-2 border-l-2 border-ink/20 pl-3 text-sm text-ink-soft">
          <MathText text={q.questionStem} />
        </div>
      )}

      <p className="text-base leading-relaxed text-ink">
        <span className="sr-only">Student asked: </span>“{q.text}”
      </p>
      {q.audioUrl && <VoiceNote src={q.audioUrl} label={`${q.studentName}’s voice note`} />}

      {!open && q.replyText && (
        <div className="margin-note">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Your reply</p>
          <p className="mt-1">{q.replyText}</p>
          {q.replyAudioUrl && (
            <div className="mt-2">
              <VoiceNote src={q.replyAudioUrl} label="Your voice reply" />
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`reply-${q.id}`} className="text-sm font-medium text-ink">
              Reply
            </label>
            <DictateButton label="Dictate" onText={({ text }) => setReply((r) => (r.trim() ? `${r.trim()} ${text}` : text))} />
          </div>
          <Textarea
            id={`reply-${q.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply, dictate it, or record a voice reply"
            className="min-h-16 text-base"
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => submit()} disabled={busy || !reply.trim()}>
              <Send className="size-4" aria-hidden="true" /> {busy ? "Sending…" : "Send reply"}
            </Button>
            <VoiceButton size="sm" label="Record a voice reply" processingLabel="Sending…" onAudio={(wav) => submit(wav)} />
          </div>
          {error && <p className="text-sm text-redpen">{error}</p>}
        </div>
      )}
    </li>
  );
}

/** Teacher inbox: questions students sent by voice or text, answerable by voice or text. */
export function StudentQuestions() {
  const [items, setItems] = useState<StudentQuery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswered, setShowAnswered] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson<{ queries: StudentQuery[] }>("/api/teacher/queries");
      setItems(d.queries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load questions");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const update = (q: StudentQuery) => setItems((list) => (list ?? []).map((x) => (x.id === q.id ? q : x)));

  if (!items) return error ? <p className="margin-note">Couldn&apos;t load student questions ({error}).</p> : <p className="text-sm text-ink-soft">Loading questions…</p>;

  const open = items.filter((q) => q.status === "open");
  const answered = items.filter((q) => q.status === "answered");

  if (!items.length) return <p className="margin-note">No questions yet. Students can ask you by voice or text from any practice question.</p>;

  return (
    <div className="flex flex-col gap-4">
      {open.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {open.map((q) => (
            <QueryCard key={q.id} q={q} onUpdated={update} />
          ))}
        </ul>
      ) : (
        <p className="margin-note">All caught up: every question has a reply.</p>
      )}
      {answered.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAnswered((v) => !v)}
            aria-expanded={showAnswered}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <ChevronDown className={cn("size-4 transition-transform", showAnswered && "rotate-180")} aria-hidden="true" />
            Answered ({answered.length})
          </button>
          {showAnswered && (
            <ul className="mt-3 grid gap-4 md:grid-cols-2">
              {answered.map((q) => (
                <QueryCard key={q.id} q={q} onUpdated={update} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
