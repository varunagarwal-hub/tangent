"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BookOpen, Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SessionEntry {
  attemptId: string;
  conceptName: string;
  correct: boolean;
  masteryBefore: number;
  masteryAfter: number;
  misconceptionName: string | null;
  flawed: boolean;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Shown after every 5 practice answers: what happened, how mastery moved, what was caught. */
export function SessionRecap({ entries }: { entries: SessionEntry[] }) {
  const last = entries.slice(-5);
  const right = last.filter((e) => e.correct && !e.flawed).length;

  // first "before" and last "after" per concept, in order of appearance
  const byConcept = new Map<string, { before: number; after: number; n: number }>();
  for (const e of last) {
    const c = byConcept.get(e.conceptName);
    if (c) {
      c.after = e.masteryAfter;
      c.n++;
    } else byConcept.set(e.conceptName, { before: e.masteryBefore, after: e.masteryAfter, n: 1 });
  }
  const caught = [...new Set(last.map((e) => e.misconceptionName).filter((x): x is string => !!x))];

  return (
    <section aria-labelledby="recap-title" className="paper-card border-l-4 border-l-[var(--highlighter-solid)] p-5">
      <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">Session recap · last {last.length} questions</p>
      <h2 id="recap-title" className="mt-1 text-2xl text-ink">
        {right} of {last.length} right with sound working
      </h2>

      <ol className="mt-3 flex gap-1.5" aria-label="Your last answers">
        {last.map((e) => (
          <li
            key={e.attemptId}
            title={`${e.conceptName}: ${e.correct ? (e.flawed ? "right answer, flawed working" : "right") : "wrong"}`}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full border",
              e.correct && !e.flawed && "border-mastery-high bg-mastery-high/15 text-mastery-high",
              e.correct && e.flawed && "border-mastery-mid bg-mastery-mid/15 text-[#9a6212] dark:text-mastery-mid",
              !e.correct && "border-redpen bg-redpen/10 text-redpen",
            )}
          >
            {e.correct ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
            <span className="sr-only">{e.correct ? "right" : "wrong"}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-sans text-sm font-semibold text-ink">How mastery moved</h3>
          <ul className="mt-1.5 space-y-1 text-sm">
            {[...byConcept].map(([name, c]) => {
              const delta = Math.round((c.after - c.before) * 100);
              const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
              return (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">{name}</span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 font-mono tabular-nums",
                      delta > 0 ? "text-mastery-high" : delta < 0 ? "text-redpen" : "text-ink-soft",
                    )}
                  >
                    {pct(c.before)} → {pct(c.after)}
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold text-ink">Mistakes caught</h3>
          {caught.length ? (
            <ul className="mt-1.5 space-y-1 text-sm text-ink">
              {caught.map((m) => (
                <li key={m} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-redpen" aria-hidden="true" />
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-ink-soft">None this round. Clean working.</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Next, the planner keeps targeting your weakest point: anything caught above gets a question built to test it, and
        concepts you&apos;re close to forgetting come back as reviews.
      </p>
      <Link href="/mistakes" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline">
        <BookOpen className="size-4" aria-hidden="true" /> Open your Mistake Journal
      </Link>
    </section>
  );
}
