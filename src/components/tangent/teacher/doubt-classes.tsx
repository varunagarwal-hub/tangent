"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

const EVENT = "tangent:doubt-classes";

/** Tomorrow 6 PM, as a datetime-local value in the browser's time zone. */
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** "Schedule a doubt class" for a misconception (everyone with it open) or a named group. */
export function ScheduleDoubtClass({ misconceptionId, studentNames, defaultTitle }: { misconceptionId?: string; studentNames?: string[]; defaultTitle: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/teacher/doubt-classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ misconceptionId, studentNames, title: defaultTitle, startsAt: new Date(when).toISOString(), link: link.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't schedule it.");
      setMsg({ ok: true, text: `Scheduled for ${fmtWhen(new Date(when).toISOString())}: ${d.invited} student${d.invited > 1 ? "s" : ""} invited.` });
      setOpen(false);
      window.dispatchEvent(new Event(EVENT));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't schedule it." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setWhen(defaultWhen());
            setOpen(true);
            setMsg(null);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          <CalendarPlus className="size-3.5" aria-hidden="true" /> Schedule a doubt class
        </button>
      ) : (
        <form onSubmit={submit} className="mt-1 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-2">
          <label className="text-xs text-ink-soft">
            When
            <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className="mt-0.5 block rounded-md border border-border bg-background px-2 py-1 text-sm text-ink" />
          </label>
          <label className="min-w-40 flex-1 text-xs text-ink-soft">
            Meeting link (optional)
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet…" className="mt-0.5 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-ink" />
          </label>
          <Button size="sm" type="submit" disabled={busy}>{busy ? "Scheduling…" : "Schedule"}</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </form>
      )}
      {msg && <p className={msg.ok ? "mt-1 text-xs text-mastery-high" : "mt-1 text-xs text-redpen"} role="status">{msg.text}</p>}
    </div>
  );
}

interface Upcoming { id: string; title: string; startsAt: string; link: string | null; students: { id: string; name: string }[] }

/** The teacher's upcoming doubt classes; refreshes when one is scheduled anywhere on the page. */
export function UpcomingDoubtClasses() {
  const [list, setList] = useState<Upcoming[] | null>(null);
  const load = useCallback(() => {
    fetch("/api/teacher/doubt-classes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setList(d.classes))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);

  const cancel = async (id: string) => {
    await fetch(`/api/teacher/doubt-classes?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!list) return null;
  if (!list.length) return <p className="py-2 text-sm text-ink-soft">None scheduled. Use &quot;Schedule a doubt class&quot; on a leaderboard row or a lesson-plan group.</p>;
  return (
    <ul className="divide-y divide-dashed divide-border">
      {list.map((c) => (
        <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="font-medium text-ink">{c.title}</p>
            <p className="text-xs text-ink-soft">
              <span className="font-mono">{fmtWhen(c.startsAt)}</span> · {c.students.length} student{c.students.length > 1 ? "s" : ""}: {c.students.slice(0, 5).map((s) => s.name.split(" ")[0]).join(", ")}
              {c.students.length > 5 ? ` +${c.students.length - 5}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {c.link && (
              <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
                <Video className="size-3.5" aria-hidden="true" /> link
              </a>
            )}
            <button type="button" onClick={() => void cancel(c.id)} className="rounded p-1 text-ink-soft hover:text-redpen" aria-label={`Cancel ${c.title}`}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
