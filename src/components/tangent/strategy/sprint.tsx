"use client";

import Link from "next/link";
import type { StrategyData } from "@/lib/api-types";
import { MasteryBar } from "@/components/tangent/teacher/shared";

/** CAT weight 1–3 as tally ticks (text label alongside for screen readers). */
function WeightTicks({ w }: { w: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`CAT weight ${w} of 3`}>
      <svg viewBox="0 0 26 16" className="h-4 w-[26px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${4 + i * 8} 2 L ${3 + i * 8} 14`}
            stroke={i < w ? "var(--redpen)" : "var(--ink)"}
            strokeOpacity={i < w ? 1 : 0.18}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <span className="sr-only">CAT weight {w} of 3</span>
    </span>
  );
}

export function Sprint({ rows }: { rows: StrategyData["sprint"] }) {
  const max = Math.max(...rows.map((r) => r.score), 0.0001);
  return (
    <div className="paper-card tg-notebook p-5 pl-6 sm:pl-14">
      <p className="font-hand text-2xl leading-tight text-redpen">If CAT were in 3 weeks: your highest-yield concepts</p>
      <p className="mt-1 text-sm text-ink-soft">Ranked by CAT weight × what you still have to gain ÷ how hard it will be to move.</p>
      <ol className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.conceptId} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
            <span className="font-mono text-lg leading-6 text-redpen tabular-nums">{i + 1}.</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 font-medium text-ink">
                  {r.name} <span className="text-xs font-normal text-ink-soft">· {r.area}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-ink-soft">
                  <WeightTicks w={r.weight} />
                  <span>
                    yield <span className="font-mono text-ink">{Math.round((r.score / max) * 100)}</span>
                  </span>
                </span>
              </div>
              <MasteryBar p={r.p} className="mt-1" />
            </div>
          </li>
        ))}
      </ol>
      <Link href="/practice" className="mt-5 inline-flex text-sm font-medium text-ink underline underline-offset-4 hover:text-redpen">
        Start with #1 in practice →
      </Link>
    </div>
  );
}
