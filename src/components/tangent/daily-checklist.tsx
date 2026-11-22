"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { id: string; label: string; detail: string; href: string; done: boolean }

function RedPenTick() {
  return (
    <svg viewBox="0 0 48 40" className="tick-draw h-7 w-8 shrink-0" aria-hidden="true">
      <path d="M5 22 C 10 26, 14 31, 18 35 C 24 24, 33 13, 44 4" fill="none" stroke="var(--redpen)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Today's 3-item ritual. Server computes the ticks; this only renders them and the evening nudge. */
export function DailyChecklist({ items, done, streak, activeToday, today }: { items: Item[]; done: number; streak: number; activeToday: boolean; today: string }) {
  return (
    <section className="paper-card p-6" aria-labelledby="checklist-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-h" className="text-2xl">
          Today&apos;s checklist <span className="font-mono text-lg text-ink-soft">{done}/3</span>
        </h2>
        <p className="text-sm text-ink-soft">{done === 3 ? "All done. Streak safe." : activeToday ? "Streak safe for today." : "Do any one to keep your streak."}</p>
      </div>
      <ul className="mt-4 divide-y divide-dashed divide-border">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={it.href} className="group flex items-center gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-ink/25" aria-hidden="true">
                {it.done && <RedPenTick />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-medium text-ink", it.done && "text-ink-soft line-through decoration-redpen/50")}>{it.label}</span>
                <span className="block text-sm text-ink-soft">{it.detail}</span>
              </span>
              <span className="sr-only">{it.done ? "done" : "not done"}</span>
              {!it.done && <ArrowRight className="size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
      <StreakNudge done={done} streak={streak} activeToday={activeToday} today={today} />
    </section>
  );
}

/** After 6 PM IST with the checklist incomplete: a dismissible red-pen note, remembered per day. */
function StreakNudge({ done, streak, activeToday, today }: { done: number; streak: number; activeToday: boolean; today: string }) {
  const [show, setShow] = useState(false);
  const key = `tangent-nudge-${today}`;

  useEffect(() => {
    if (done === 3) return;
    const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
    const forced = new URLSearchParams(window.location.search).has("nudge"); // for demos
    if (hour < 18 && !forced) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {}
    if (!dismissed) setShow(true);
  }, [done, key]);

  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  };
  return (
    <div className="margin-note relative mt-4 pr-9" role="status">
      {activeToday
        ? `${3 - done} left on today's checklist. A quick sprint ticks one off.`
        : `Your ${streak}-day streak ends tonight: one quick sprint keeps it alive.`}{" "}
      <Link href="/play/sprint" className="font-medium underline underline-offset-2">Start a sprint</Link>
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded p-1 text-ink-soft hover:text-ink" aria-label="Dismiss reminder">
        <X className="size-4" />
      </button>
    </div>
  );
}
