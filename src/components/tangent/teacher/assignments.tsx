"use client";

import type { AssignmentRow } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { pct, shortDate } from "./shared";

/** Tiny before → after slope: baseline dot, current dot, the line coloured by direction. */
function Slope({ a }: { a: AssignmentRow }) {
  const W = 120;
  const H = 44;
  const y = (p: number) => 4 + (1 - p) * (H - 8);
  if (a.baseline == null) return <span className="text-sm text-ink-soft">no baseline</span>;
  const b = a.baseline;
  const c = a.current ?? a.baseline;
  const up = (a.lift ?? c - b) >= 0;
  const stroke = up ? "var(--mastery-high)" : "var(--redpen)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-[120px] shrink-0" aria-hidden="true">
      <line x1="14" x2="14" y1="2" y2={H - 2} stroke="var(--border)" strokeDasharray="2 3" />
      <line x1={W - 14} x2={W - 14} y1="2" y2={H - 2} stroke="var(--border)" strokeDasharray="2 3" />
      <line x1="14" y1={y(b)} x2={W - 14} y2={y(c)} stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy={y(b)} r="4" fill="var(--card)" stroke="var(--ink-soft)" strokeWidth="2" />
      <circle cx={W - 14} cy={y(c)} r="4.5" fill={stroke} />
    </svg>
  );
}

export function Assignments({ rows, freshId }: { rows: AssignmentRow[]; freshId?: string | null }) {
  if (rows.length === 0)
    return (
      <p className="font-hand text-xl text-ink-soft">
        Nothing assigned yet. Generate Monday&apos;s plan and assign its set to start measuring lift.
      </p>
    );
  return (
    <ul className="flex flex-col">
      {rows.map((a) => {
        const lift = a.lift != null ? Math.round(a.lift * 100) : null;
        return (
          <li
            key={a.id}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-dashed py-3 last:border-b-0",
              freshId === a.id && "rounded-md bg-highlighter/40 px-2",
            )}
          >
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-medium text-ink">
                <span className="font-mono text-xs text-ink-soft">{a.conceptId}</span> {a.conceptName}
              </p>
              <p className="text-xs text-ink-soft">
                {shortDate(a.createdAt)} · <span className="font-mono">{a.questionCount}</span> question{a.questionCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 text-right font-mono text-xs tabular-nums text-ink-soft" title="Class mastery when assigned">
                {pct(a.baseline)}
              </span>
              <Slope a={a} />
              <span className="w-10 font-mono text-xs tabular-nums text-ink" title="Class mastery now">
                {pct(a.current)}
              </span>
            </div>
            <span
              className={cn(
                "w-20 text-right font-mono text-sm font-semibold tabular-nums",
                lift == null ? "text-ink-soft" : lift > 0 ? "text-mastery-high" : lift < 0 ? "text-redpen" : "text-ink-soft",
              )}
            >
              {lift == null ? "—" : `${lift > 0 ? "+" : ""}${lift} pts`}
              <span className="sr-only">
                {" "}
                class mastery went from {pct(a.baseline)} to {pct(a.current)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
