"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Mic } from "lucide-react";
import type { StudentQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/** Today page: the student's questions to their teacher and the replies (text and/or voice). */
export function MyQuestions({ teacherName = "Prof. Mehta" }: { teacherName?: string }) {
  const [items, setItems] = useState<StudentQuery[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/queries")
        .then((r) => (r.ok ? r.json() : { queries: [] }))
        .then((d) => alive && setItems(d.queries ?? []))
        .catch(() => alive && setItems([]));
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 3);

  return (
    <section aria-labelledby="myq-title" className="paper-card p-5 sm:p-6">
      <h2 id="myq-title" className="text-2xl">
        Your questions to {teacherName}
      </h2>
      <ul className="mt-3 divide-y divide-dashed divide-border">
        {shown.map((q) => (
          <li key={q.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[0.95rem] text-ink">
                {q.viaVoice && <Mic className="mr-1 inline size-3.5 text-ink-soft" aria-label="Voice question" />}
                {q.text}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  q.status === "answered" ? "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" : "border-ink/20 text-ink-soft",
                )}
              >
                {q.status === "answered" ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
                {q.status === "answered" ? "Answered" : "Waiting"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              {q.conceptName ? `${q.conceptName} · ` : ""}
              {ago(q.createdAt)}
            </p>
            {q.status === "answered" && (
              <div className="margin-note mt-2">
                <p className="text-sm font-semibold text-ink">{teacherName} replied</p>
                {q.replyText && <p className="mt-0.5">{q.replyText}</p>}
                {q.replyAudioUrl && <audio controls src={q.replyAudioUrl} className="mt-2 h-9 w-full max-w-sm" aria-label={`${teacherName}'s voice reply`} />}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
