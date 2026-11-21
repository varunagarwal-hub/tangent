"use client";

import { createRef, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import { useReducedMotion } from "motion/react";
import {
  Activity,
  Database,
  FilePlus2,
  GraduationCap,
  MessageCircleHeart,
  PenLine,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Cog,
  UserCheck,
  ArrowRightCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

type Kind = "ai" | "code" | "mixed" | "io";
type NodeId =
  | "work"
  | "detective"
  | "learner"
  | "planner"
  | "generator"
  | "verifier"
  | "pool"
  | "next"
  | "coach"
  | "diagnostician"
  | "analyst"
  | "corrections";

const NODES: Record<NodeId, { label: string; sub: string; kind: Kind; Icon: LucideIcon }> = {
  work: { label: "Student work", sub: "typed · drawn · photo", kind: "io", Icon: PenLine },
  detective: { label: "Detective", sub: "Gemini vision + Flash", kind: "ai", Icon: ScanSearch },
  learner: { label: "Learner model", sub: "BKT · Elo · FSRS", kind: "code", Icon: Activity },
  planner: { label: "Planner", sub: "scorer + Flash “why”", kind: "mixed", Icon: Route },
  generator: { label: "Generator", sub: "Flash", kind: "ai", Icon: FilePlus2 },
  verifier: { label: "Verifier", sub: "Pro, solves blind", kind: "ai", Icon: ShieldCheck },
  pool: { label: "Pre-verified pool", sub: "≥3 per concept × band", kind: "code", Icon: Database },
  next: { label: "Next question", sub: "served in <200ms", kind: "io", Icon: ArrowRightCircle },
  coach: { label: "Coach", sub: "Flash · feedback, Skip Coach", kind: "ai", Icon: MessageCircleHeart },
  diagnostician: { label: "Diagnostician", sub: "adaptive 12 Qs + Flash", kind: "mixed", Icon: Stethoscope },
  analyst: { label: "Teacher analyst", sub: "groups + Pro lesson plan", kind: "mixed", Icon: GraduationCap },
  corrections: { label: "Teacher corrections", sub: "→ few-shot examples", kind: "io", Icon: UserCheck },
};

const KIND: Record<Kind, { tag: string; Icon: LucideIcon; cls: string; tagCls: string }> = {
  ai: { tag: "AI", Icon: Sparkles, cls: "border-redpen/60 border-dashed", tagCls: "bg-redpen/10 text-redpen border-redpen/40" },
  code: { tag: "code", Icon: Cog, cls: "border-ink/50", tagCls: "bg-ink/8 text-ink border-ink/30" },
  mixed: { tag: "code + AI", Icon: Cog, cls: "border-ink/40", tagCls: "bg-highlighter text-ink border-ink/20" },
  io: { tag: "", Icon: Cog, cls: "border-border bg-paper", tagCls: "" },
};

/* Desktop: a loop. Top row = side agents, middle row = main pipeline →, bottom row = return path ←. */
const GRID: Record<NodeId, string> = {
  diagnostician: "lg:col-start-1 lg:row-start-1",
  corrections: "lg:col-start-2 lg:row-start-1",
  coach: "lg:col-start-3 lg:row-start-1",
  analyst: "lg:col-start-4 lg:row-start-1",
  work: "lg:col-start-1 lg:row-start-2",
  detective: "lg:col-start-2 lg:row-start-2",
  learner: "lg:col-start-3 lg:row-start-2",
  planner: "lg:col-start-4 lg:row-start-2",
  generator: "lg:col-start-5 lg:row-start-2",
  next: "lg:col-start-1 lg:row-start-3",
  pool: "lg:col-start-3 lg:row-start-3",
  verifier: "lg:col-start-5 lg:row-start-3",
};

/* Mobile: one vertical column in loop order, side agents attached where they plug in. */
const MOBILE_ORDER: NodeId[] = ["work", "corrections", "detective", "diagnostician", "learner", "coach", "analyst", "planner", "generator", "verifier", "pool", "next"];
const MOBILE_SIDE = new Set<NodeId>(["corrections", "diagnostician", "coach", "analyst"]);

type Edge = { from: NodeId; to: NodeId; curvature?: number; reverse?: boolean; dy?: number; dx?: number; red?: boolean };

const DESKTOP_EDGES: Edge[] = [
  { from: "work", to: "detective" },
  { from: "detective", to: "learner" },
  { from: "learner", to: "planner" },
  { from: "planner", to: "generator" },
  { from: "generator", to: "verifier", dx: -10 },
  { from: "verifier", to: "generator", dx: 10, reverse: true, red: true },
  { from: "verifier", to: "pool", reverse: true },
  { from: "pool", to: "next", reverse: true },
  { from: "next", to: "work" },
  { from: "corrections", to: "detective", red: true },
  { from: "diagnostician", to: "learner" },
  { from: "learner", to: "coach" },
  { from: "learner", to: "analyst" },
];

const MOBILE_EDGES: Edge[] = [
  { from: "work", to: "detective" },
  { from: "detective", to: "learner" },
  { from: "learner", to: "planner" },
  { from: "planner", to: "generator" },
  { from: "generator", to: "verifier" },
  { from: "verifier", to: "pool" },
  { from: "pool", to: "next" },
];

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

function Node({ id, nodeRef, side }: { id: NodeId; nodeRef: RefObject<HTMLDivElement | null>; side?: boolean }) {
  const n = NODES[id];
  const k = KIND[n.kind];
  return (
    <div
      ref={nodeRef}
      className={cn(
        "relative z-10 flex min-w-0 items-start gap-2.5 rounded-xl border-2 bg-card px-3 py-2.5 shadow-[var(--shadow-paper)]",
        k.cls,
        side && "ml-8 border-[1.5px] py-2 lg:ml-0",
      )}
    >
      <n.Icon className={cn("mt-0.5 size-4 shrink-0", n.kind === "ai" ? "text-redpen" : "text-ink")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold leading-tight text-ink">{n.label}</span>
          {k.tag && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight", k.tagCls)}>
              <k.Icon className="size-2.5" aria-hidden="true" />
              {k.tag}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-snug text-ink-soft">{n.sub}</p>
      </div>
    </div>
  );
}

export function Architecture() {
  const wide = useWide();
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(
    () => Object.fromEntries((Object.keys(NODES) as NodeId[]).map((id) => [id, createRef<HTMLDivElement>()])) as Record<NodeId, RefObject<HTMLDivElement | null>>,
    [],
  );
  const edges = wide ? DESKTOP_EDGES : MOBILE_EDGES;

  return (
    <figure className="paper-card graph-paper relative overflow-hidden p-4 sm:p-6">
      <figcaption className="sr-only">
        The agent loop. Student work goes to the Detective (AI), which updates the deterministic learner model (BKT, Elo, FSRS). The Planner picks the next move;
        the Generator (AI) drafts a question and the Verifier (AI) solves it blind, rejecting mismatches back to the Generator. Accepted questions fill a
        pre-verified pool that serves the next question instantly. The Coach and Diagnostician sit on the student side; the Teacher analyst reads class data,
        and teacher corrections become few-shot examples that flow back into the Detective.
      </figcaption>

      <div ref={containerRef} className="relative" aria-hidden="true">
        {wide ? (
          <div className="grid grid-cols-5 grid-rows-[auto_auto_auto] gap-x-8 gap-y-14">
            {(Object.keys(GRID) as NodeId[]).map((id) => (
              <div key={id} className={GRID[id]}>
                <Node id={id} nodeRef={refs[id]} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {MOBILE_ORDER.map((id) => (
              <div key={id} className="relative">
                {MOBILE_SIDE.has(id) && (
                  <span className="absolute top-1/2 left-3 h-px w-5 -translate-y-1/2 border-t-2 border-dashed border-ink/30" />
                )}
                <Node id={id} nodeRef={refs[id]} side={MOBILE_SIDE.has(id)} />
              </div>
            ))}
            <p className="font-hand text-xl leading-none text-redpen">↺ and back to the student&apos;s next answer</p>
          </div>
        )}

        {edges.map((e) => (
          <AnimatedBeam
            key={`${wide ? "d" : "m"}-${e.from}-${e.to}`}
            containerRef={containerRef}
            fromRef={refs[e.from]}
            toRef={refs[e.to]}
            curvature={e.curvature ?? 0}
            reverse={e.reverse}
            startXOffset={e.dx ?? 0}
            endXOffset={e.dx ?? 0}
            pathColor="var(--ink)"
            pathOpacity={0.22}
            pathWidth={2}
            gradientStartColor={e.red ? "var(--redpen)" : "var(--ink)"}
            gradientStopColor="var(--redpen)"
            duration={reduced ? 0 : 4}
            repeat={reduced ? 0 : Infinity}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-ink/20 pt-3 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-dashed border-redpen/60" aria-hidden="true" />
          <Sparkles className="size-3 text-redpen" aria-hidden="true" /> AI (Gemini): reads, diagnoses, writes, explains
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-ink/50" aria-hidden="true" />
          <Cog className="size-3" aria-hidden="true" /> deterministic code: the maths
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border border-ink/20 bg-highlighter" aria-hidden="true" />
          code decides, AI phrases it
        </span>
      </div>
    </figure>
  );
}
