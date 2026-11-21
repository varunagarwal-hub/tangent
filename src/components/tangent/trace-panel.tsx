"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Cog,
  FilePlus2,
  GraduationCap,
  MessageCircleHeart,
  Route,
  ScanSearch,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TraceStep } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PenLoader } from "./pen-loader";
import { cn } from "@/lib/utils";

const AGENTS: Record<string, { name: string; Icon: LucideIcon }> = {
  diagnostician: { name: "Diagnostician", Icon: Stethoscope },
  detective: { name: "Detective", Icon: ScanSearch },
  planner: { name: "Planner", Icon: Route },
  generator: { name: "Generator", Icon: FilePlus2 },
  verifier: { name: "Verifier", Icon: ShieldCheck },
  coach: { name: "Coach", Icon: MessageCircleHeart },
  teacher_analyst: { name: "Teacher analyst", Icon: GraduationCap },
  learner_model: { name: "Learner model", Icon: Activity },
};

function agentMeta(id: string) {
  if (AGENTS[id]) return AGENTS[id];
  const pretty = id.replace(/_/g, " ");
  return { name: pretty.charAt(0).toUpperCase() + pretty.slice(1), Icon: Cog };
}

const STATUS: Record<TraceStep["status"], { label: string; Icon: LucideIcon; className: string }> = {
  ok: { label: "ok", Icon: Check, className: "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" },
  fallback: { label: "fallback", Icon: Undo2, className: "border-mastery-mid/60 bg-mastery-mid/15 text-amber-ink" },
  rejected: { label: "rejected", Icon: X, className: "border-redpen/50 bg-redpen/10 text-redpen" },
  error: { label: "error", Icon: TriangleAlert, className: "border-redpen bg-redpen/15 text-redpen" },
};

export function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusChip({ status }: { status: TraceStep["status"] }) {
  const s = STATUS[status] ?? STATUS.ok;
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[0.7rem] font-medium", s.className)}>
      <s.Icon className="size-3" aria-hidden="true" />
      {s.label}
    </span>
  );
}

/** Vertical timeline of agent steps, each drawing in with a red-pen dot travelling down the connector. */
export function TracePanel({
  steps,
  running,
  title = "Under the hood",
  className,
}: {
  steps: TraceStep[];
  running: boolean;
  title?: string | null;
  className?: string;
}) {
  const reduced = useReducedMotion();
  // steps present on first render stagger in; steps streamed in later animate on arrival
  const initialCount = useRef(steps.length);

  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label={title ?? "Agent trace"}>
      {title && <h3 className="text-xl text-ink">{title}</h3>}
      {steps.length === 0 && !running && <p className="text-sm text-ink-soft">No agent steps yet.</p>}
      <ol className="flex flex-col" aria-live="polite">
        {steps.map((step, i) => {
          const { name, Icon } = agentMeta(step.agent);
          const delay = reduced ? 0 : i < initialCount.current ? i * 0.12 : 0;
          const isLast = i === steps.length - 1;
          const showLine = !isLast || running;
          return (
            <motion.li
              key={`${i}-${step.agent}`}
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-4"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0.15 : 0.35, delay, ease: "easeOut" }}
            >
              {/* connector to the next step */}
              {showLine && (
                <span aria-hidden="true" className="absolute top-8 bottom-0 left-[calc(1rem-1px)] w-0.5 overflow-hidden">
                  <motion.span
                    className="absolute inset-0 origin-top bg-ink/20"
                    initial={reduced ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.45, delay: delay + 0.2, ease: "easeInOut" }}
                  />
                  {!reduced && (
                    <motion.span
                      className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-redpen"
                      initial={{ top: "0%", opacity: 0 }}
                      animate={{ top: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 0.7, delay: delay + 0.25, ease: "easeInOut" }}
                    />
                  )}
                </span>
              )}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border bg-card text-ink",
                  (step.status === "rejected" || step.status === "error") && "border-redpen/60 text-redpen",
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-ink">{name}</span>
                  <StatusChip status={step.status} />
                  <span className="ml-auto font-mono text-xs text-ink-soft tabular-nums" title={`${Math.round(step.ms)} ms`}>
                    {formatMs(step.ms)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm leading-snug text-ink-soft">{step.summary}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
      {running && <PenLoader label="Agents at work…" className="pl-1" />}
    </section>
  );
}

/**
 * "Under the hood" dock. lg+: a sticky, collapsible right-side panel.
 * Below lg: a floating button that opens the trace in a bottom sheet.
 */
export function TraceDock({ steps, running, className }: { steps: TraceStep[]; running: boolean; className?: string }) {
  const [open, setOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = steps.length;

  return (
    <>
      <aside
        className={cn("sticky top-20 hidden max-h-[calc(100dvh-6rem)] shrink-0 self-start lg:block", open ? "w-80" : "w-12", className)}
        aria-label="Under the hood"
      >
        {open ? (
          <div className="paper-card flex max-h-[calc(100dvh-6rem)] flex-col">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
              <span className="font-serif text-lg text-ink">
                Under the hood <span className="font-mono text-xs text-ink-soft">({count})</span>
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Collapse under the hood panel" aria-expanded={true}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4">
              <TracePanel steps={steps} running={running} title={null} />
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label={`Expand under the hood panel, ${count} steps`}
            aria-expanded={false}
            className="paper-card h-auto w-12 flex-col gap-2 py-3"
          >
            <ChevronLeft aria-hidden="true" />
            <span className="font-mono text-xs">{count}</span>
            <span className="text-xs [writing-mode:vertical-rl]">Under the hood</span>
          </Button>
        )}
      </aside>

      <div className="fixed right-4 bottom-4 z-40 lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button className="h-10 rounded-full px-4 shadow-lg" />}>
            <Cog className={cn(running && "animate-spin [animation-duration:3s]")} aria-hidden="true" />
            Under the hood ({count})
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-xl bg-paper">
            <SheetHeader className="pb-0">
              <SheetTitle className="font-serif text-xl">Under the hood</SheetTitle>
              <SheetDescription>What each agent did for this answer.</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <TracePanel steps={steps} running={running} title={null} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
