"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RefreshCw, Timer } from "lucide-react";
import type { StrategyData } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { PenLoader } from "@/components/tangent/pen-loader";
import { SectionHeading, fetchJson } from "@/components/tangent/teacher/shared";
import { SkipCoach } from "@/components/tangent/strategy/skip-coach";
import { Calibration } from "@/components/tangent/strategy/calibration";
import { Sprint } from "@/components/tangent/strategy/sprint";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/tangent/page-intro";
import { InfoTip } from "@/components/tangent/info-tip";

function SprintToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-ink shadow-[var(--shadow-paper)] hover:border-ink/40"
    >
      <Timer className={cn("size-4", on ? "text-redpen" : "text-ink-soft")} aria-hidden="true" />
      Sprint mode
      <span className={cn("relative h-5 w-9 rounded-full border transition-colors", on ? "border-redpen bg-redpen" : "border-ink/30 bg-ink/10")} aria-hidden="true">
        <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-card shadow transition-[left]", on ? "left-[1.1rem]" : "left-0.5")} />
      </span>
      <span className="w-6 font-mono text-xs text-ink-soft" aria-hidden="true">
        {on ? "on" : "off"}
      </span>
    </button>
  );
}

export function StrategyClient() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sprint, setSprint] = useState(false);
  const reduced = useReducedMotion();

  const load = useCallback(() => {
    setError(null);
    fetchJson<StrategyData>("/api/strategy")
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        id="strategy"
        steps={[
          "The Skip Coach replays your answers with real CAT marking (+3 / −1).",
          "See whether skipping low-mastery or guessed questions would have scored more.",
          "Calibration shows where you're overconfident; Sprint mode ranks what to study if CAT were close.",
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-hand text-xl leading-none text-redpen">exam temperament</p>
          <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Strategy</h1>
          <p className="mt-4 max-w-2xl text-ink-soft">
            Knowing maths is half of CAT. The other half is knowing <em>which</em> questions to leave. Replayed on your own history, with CAT&apos;s real marking.
          </p>
        </div>
        <SprintToggle on={sprint} onChange={setSprint} />
      </header>

      {!data && !error && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <PenLoader label="Replaying your answers under CAT marking…" />
          <div className="paper-card h-80 animate-pulse" />
          <div className="paper-card h-64 animate-pulse" />
        </div>
      )}

      {error && !data && (
        <div className="paper-card flex flex-col items-start gap-3 p-6" role="alert">
          <p className="margin-note">Couldn&apos;t open your strategy page ({error}).</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <AnimatePresence initial={false}>
            {sprint && (
              <motion.section
                key="sprint"
                aria-labelledby="sprint-h"
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <h2 id="sprint-h" className="sr-only">
                  Sprint mode
                </h2>
                {data.sprint.length ? (
                  <Sprint rows={data.sprint} />
                ) : (
                  <p className="paper-card margin-note p-5">Nothing to sprint on yet. Take the diagnostic first.</p>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <section aria-labelledby="skip-h" className="flex flex-col gap-4">
            <SectionHeading id="skip-h" kicker="+3 / −1 / 0" title={<span className="inline-flex items-center gap-1.5">Skip Coach <InfoTip term="skipCoach" /></span>} />
            <SkipCoach data={data.skip} />
          </section>

          <section aria-labelledby="cal-h" className="flex flex-col gap-4">
            <SectionHeading id="cal-h" kicker="confidence loop" title={<span className="inline-flex items-center gap-1.5">Calibration <InfoTip term="calibration" /></span>} />
            <Calibration data={data.calibration} />
          </section>
        </>
      )}
    </div>
  );
}
