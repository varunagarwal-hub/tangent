"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { RedPenWork } from "@/components/tangent/red-pen-work";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  {
    tab: "Successive discounts",
    concept: "Profit, Loss & Discount",
    question: "A jacket marked ₹2000 gets successive discounts of 20% and 10%. What is the selling price?",
    lines: [
      { n: 1, text: "MP = ₹2000" },
      { n: 2, text: "Total discount = 20% + 10% = 30%" },
      { n: 3, text: "SP = 2000 × 0.7 = ₹1400" },
    ],
    errorLine: 2,
    note: "Successive discounts multiply: 0.8 × 0.9 = 0.72, so it's 28% off, not 30%.",
  },
  {
    tab: "Average speed",
    concept: "Time, Speed & Distance",
    question: "Riya drives from Pune to Lonavala at 40 km/h and returns at 60 km/h. What is her average speed?",
    lines: [
      { n: 1, text: "Same distance d both ways" },
      { n: 2, text: "Avg speed = (40 + 60) / 2" },
      { n: 3, text: "= 50 km/h" },
    ],
    errorLine: 2,
    note: "Equal distances, not equal times. Use 2 × 40 × 60 / (40 + 60) = 48 km/h.",
  },
  {
    tab: "Time & work",
    concept: "Time & Work",
    question: "A finishes a job in 10 days and B in 15 days. Working together, how long do they take?",
    lines: [
      { n: 1, text: "A: 10 days, B: 15 days" },
      { n: 2, text: "Together = 10 + 15 = 25 days" },
      { n: 3, text: "Answer: 25 days" },
    ],
    errorLine: 2,
    note: "Add the rates, not the days: 1/10 + 1/15 = 1/6, so 6 days.",
  },
];

const CYCLE_MS = 6500;

/** The red-pen moment on loop: three real CAT slips, each re-circled when it comes round. */
export function RedPenDemo() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const t = window.setTimeout(() => setI((v) => (v + 1) % EXAMPLES.length), CYCLE_MS);
    return () => window.clearTimeout(t);
  }, [i, reduced, paused]);

  const ex = EXAMPLES[i];

  return (
    <section className="mt-28 sm:mt-36" aria-labelledby="demo-title">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="font-hand text-2xl text-redpen">the red-pen moment</p>
          <h2 id="demo-title" className="mt-1 text-4xl text-ink sm:text-5xl">
            Watch it <span className="hand-underline">read rough work</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            A wrong answer tells you very little. The line where it went wrong tells you everything. Tangent&apos;s
            Detective reads every step and circles the tangent point, then explains it the way a good mentor would, in
            the margin.
          </p>

          <div role="tablist" aria-label="Examples" className="mt-8 flex flex-wrap gap-2">
            {EXAMPLES.map((e, k) => (
              <button
                key={e.tab}
                role="tab"
                aria-selected={k === i}
                aria-controls="demo-panel"
                onClick={() => setI(k)}
                className={cn(
                  "relative overflow-hidden rounded-full border px-4 py-2 text-sm transition-colors",
                  k === i ? "border-ink bg-ink text-paper" : "border-border bg-card text-ink-soft hover:text-ink",
                )}
              >
                {e.tab}
                {k === i && !reduced && !paused && (
                  <span
                    key={`bar-${i}`}
                    aria-hidden="true"
                    className="landing-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-redpen"
                    style={{ animationDuration: `${CYCLE_MS}ms` }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          id="demo-panel"
          role="tabpanel"
          aria-live="polite"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="min-h-[24rem] sm:min-h-[19rem]"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="text-sm leading-snug text-ink-soft">
              <span className="font-mono text-xs uppercase tracking-wider text-ink">Q{i + 1} · {ex.concept}</span>
              <br />
              {ex.question}
            </p>
            <div className="flex shrink-0 gap-1.5" aria-hidden="true">
              {EXAMPLES.map((e, k) => (
                <span key={e.tab} className={cn("size-2 rounded-full", k === i ? "bg-redpen" : "bg-ink/20")} />
              ))}
            </div>
          </div>
          <RedPenWork key={i} lines={ex.lines} errorLine={ex.errorLine} note={ex.note} verdict="flawed" />
        </div>
      </div>
    </section>
  );
}
