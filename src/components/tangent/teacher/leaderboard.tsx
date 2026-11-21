"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { LeaderboardRow } from "@/lib/api-types";
import { cn } from "@/lib/utils";

function Trend({ t }: { t: LeaderboardRow["trend"] }) {
  const d = t.thisWeek - t.lastWeek;
  if (d > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-redpen">
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
        <span className="font-mono tabular-nums">+{d}</span>
        <span className="sr-only"> more attempts than last week (rising)</span>
        <span className="text-xs" aria-hidden="true">rising</span>
      </span>
    );
  if (d < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-mastery-high">
        <ArrowDownRight className="size-3.5" aria-hidden="true" />
        <span className="font-mono tabular-nums">{d}</span>
        <span className="sr-only"> fewer attempts than last week (easing)</span>
        <span className="text-xs" aria-hidden="true">easing</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-ink-soft">
      <ArrowRight className="size-3.5" aria-hidden="true" />
      <span className="text-xs">flat</span>
    </span>
  );
}

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const top = rows.slice(0, 8);
  if (top.length === 0) return <p className="font-hand text-lg text-ink-soft">No active misconceptions. The class is on the curve.</p>;
  return (
    <ol className="flex flex-col">
      {top.map((r, i) => {
        const gap = i < 2;
        const pctClass = Math.round(r.pctClass * 100);
        return (
          <li
            key={r.misconceptionId}
            className={cn("relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 border-b border-dashed py-2.5 last:border-b-0", gap && "rounded-md")}
          >
            <span className={cn("pt-0.5 font-mono text-sm tabular-nums", gap ? "font-bold text-redpen" : "text-ink-soft")}>{i + 1}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={cn("font-medium text-ink", gap && "highlight")}>{r.name}</span>
                {gap && <span className="font-hand text-base leading-none text-redpen">← class-wide gap</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-soft">
                <span>
                  <span className="font-mono">{r.conceptId}</span> {r.conceptName}
                </span>
                <span>
                  <span className="font-mono tabular-nums text-ink">{r.students}</span> student{r.students === 1 ? "" : "s"}
                </span>
                <Trend t={r.trend} />
                <span className="font-mono tabular-nums">
                  {r.trend.thisWeek} this wk / {r.trend.lastWeek} last
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded-full", gap ? "bg-redpen" : "bg-ink/45")}
                    style={{ width: `${Math.max(2, pctClass)}%` }}
                  />
                </div>
                <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums text-ink">{pctClass}% of class</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
