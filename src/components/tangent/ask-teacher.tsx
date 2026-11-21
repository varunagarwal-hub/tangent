"use client";

import { useState } from "react";
import { MessageCircleQuestion, Mic, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VoiceButton, transcribeAudio } from "./voice-recorder";

/**
 * "Ask your teacher": a question about the problem the student is on, typed or spoken.
 * A recording is transcribed into the box (editable) and the voice note is sent along for playback.
 */
export function AskTeacher({
  questionId,
  conceptId,
  conceptName,
  attemptId,
  teacherName = "your teacher",
}: {
  questionId?: string;
  conceptId?: string;
  conceptName?: string;
  attemptId?: string | null;
  teacherName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudio(null);
    setAudioUrl(null);
  };

  async function send() {
    if (!text.trim() && !audio) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (audio) fd.append("audio", audio, "voice.wav");
      if (questionId) fd.append("questionId", questionId);
      if (attemptId) fd.append("attemptId", attemptId);
      if (conceptId) fd.append("conceptId", conceptId);
      const res = await fetch("/api/queries", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send that. Please try again.");
      toast.success(`Sent to ${teacherName}. You'll see the reply on your Today page.`);
      setText("");
      clearAudio();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" type="button">
            <MessageCircleQuestion className="size-4" aria-hidden="true" /> Ask your teacher
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Ask {teacherName}</DialogTitle>
          <DialogDescription>
            Stuck or unsure? Type it, or just say it. {conceptName ? `It goes with this ${conceptName} question.` : "It goes with the question you’re on."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <VoiceButton
              label={audio ? "Record again" : "Record your question"}
              processingLabel="Listening back…"
              maxSec={90}
              onAudio={async (wav) => {
                setError(null);
                clearAudio();
                setAudio(wav);
                setAudioUrl(URL.createObjectURL(wav));
                try {
                  const r = await transcribeAudio(wav, "note");
                  setText((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text));
                } catch {
                  setError("Saved your recording, but couldn't write it out. You can still send it.");
                }
              }}
            />
            {audioUrl && (
              <span className="flex items-center gap-2">
                <Mic className="size-4 text-redpen" aria-hidden="true" />
                <audio controls src={audioUrl} className="h-9 max-w-[220px]" aria-label="Your recorded question" />
                <button type="button" onClick={clearAudio} aria-label="Delete recording" className="rounded p-1 text-ink-soft hover:text-redpen">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          <label htmlFor="ask-text" className="text-sm font-medium text-ink">
            Your question
          </label>
          <Textarea
            id="ask-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. Why can’t I just add the two discounts?"
            className="bg-card"
          />
          {error && <p className="text-sm text-redpen">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending || (!text.trim() && !audio)}>
              <Send className="size-4" aria-hidden="true" /> {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
