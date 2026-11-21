"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronUp, Compass, List, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_EVENT, LS, demoStoreSnapshot, lsSet, parseDemoStore, setPersona, subscribeDemoStore, tickDemoStep, type DemoStepId } from "./events";

type PersonaKey = "riya" | "mehta" | "new";

interface Step {
  id: DemoStepId;
  title: string;
  hint: string;
  href: string;
  persona?: "riya" | "mehta";
  /** auto-tick when this path is visited (as the right persona) */
  path?: string;
}

const STEPS: Step[] = [
  { id: "today", title: "Riya's plan for today", hint: "Her next best move, reviews due and mastery by area.", href: "/today", persona: "riya", path: "/today" },
  {
    id: "redpen",
    title: "Answer with rough work",
    hint: "Pick an option, add working (or 'Use sample'), submit, and watch the red pen circle the wrong line.",
    href: "/practice",
    persona: "riya",
  },
  { id: "map", title: "Mastery Map", hint: "27 concepts coloured by mastery. Faded nodes are due for review.", href: "/map", persona: "riya", path: "/map" },
  { id: "mistakes", title: "Mistake Journal", hint: "Each misconception and how close it is to fixed. Download the Fingerprint card.", href: "/mistakes", persona: "riya", path: "/mistakes" },
  { id: "strategy", title: "Skip Coach", hint: "Riya's history replayed under CAT marking (+3 / −1).", href: "/strategy", persona: "riya", path: "/strategy" },
  { id: "teacher", title: "Switch to Prof. Mehta", hint: "The class heatmap and the mistakes shared across the batch.", href: "/teacher", persona: "mehta", path: "/teacher" },
  { id: "lesson", title: "Generate Monday's lesson plan", hint: "On the teacher page, click 'Generate': AI writes it around the class's top gaps.", href: "/teacher", persona: "mehta" },
  { id: "uth", title: "Under the hood", hint: "The 7 agents, the live agent feed and the evaluation scores.", href: "/under-the-hood", path: "/under-the-hood" },
];

const FLASH_MS = 2800;

export function DemoGuide({ persona }: { persona: PersonaKey }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // ticks after this moment get the "✓" flash; older ones (e.g. before a reload) don't replay
  const [mountedAt] = useState(() => Date.now());
  // "" on the server / first paint → nothing rendered until storage is read on the client
  const snap = useSyncExternalStore(subscribeDemoStore, demoStoreSnapshot, () => "");
  const state = useMemo(() => parseDemoStore(snap), [snap]);
  const active = !!state?.active;

  // ticks from pages (markDemoStep)
  useEffect(() => {
    const onStep = (e: Event) => {
      const step = (e as CustomEvent<{ step?: string }>).detail?.step;
      if (step) tickDemoStep(step);
    };
    window.addEventListener(DEMO_EVENT, onStep);
    return () => window.removeEventListener(DEMO_EVENT, onStep);
  }, []);

  // auto-tick page-visit steps (writes storage; the store subscription re-renders us)
  useEffect(() => {
    if (!active) return;
    for (const s of STEPS) {
      if (!s.path || pathname !== s.path) continue;
      if (s.persona === "riya" && persona === "mehta") continue;
      if (s.persona === "mehta" && persona !== "mehta") continue;
      tickDemoStep(s.id);
    }
  }, [pathname, persona, active]);

  if (!state || !active) return null;

  const done = state.done;
  const doneCount = STEPS.filter((s) => done.includes(s.id)).length;
  const nextIdx = STEPS.findIndex((s) => !done.includes(s.id));
  const next = nextIdx === -1 ? null : STEPS[nextIdx];

  // brief "✓ <step>" flash after a tick (pure CSS fade, keyed by the tick so it replays)
  const [tickStep, tickAt] = state.lastTick.split("@");
  const tickTitle = STEPS.find((s) => s.id === tickStep)?.title;
  const flashKey = tickTitle && Number(tickAt) >= mountedAt ? state.lastTick : null;

  const setCollapsed = (v: boolean) => lsSet(LS.demoCollapsed, v ? "1" : "0");
  const close = () => lsSet(LS.demoActive, "0");
  const restart = () => lsSet(LS.demoDone, "[]");

  async function go(s: Step) {
    setBusy(s.id);
    try {
      if (s.persona && s.persona !== persona) await setPersona(s.persona);
      setCollapsed(true);
      router.push(s.href);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const goButton = (s: Step, primary: boolean) => (
    <button
      type="button"
      onClick={() => go(s)}
      disabled={busy !== null}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-60",
        primary ? "bg-ink text-paper hover:opacity-90" : "text-ink-soft underline underline-offset-2 hover:text-ink",
      )}
    >
      {busy === s.id ? <Loader2 className="size-3.5 animate-spin" aria-label="Going" /> : primary ? <>Go <ArrowRight className="size-3" aria-hidden="true" /></> : "Go"}
    </button>
  );

  if (state.collapsed) {
    return (
      <div className="fixed bottom-4 left-4 z-30 flex max-w-[calc(100vw-10rem)] flex-col items-start gap-1.5 sm:max-w-[18.5rem]">
        {flashKey && (
          <span
            key={flashKey}
            role="status"
            className="demo-flash pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-mastery-high px-3 py-1 text-xs font-medium text-white shadow-[var(--shadow-paper)]"
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            {tickTitle}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-ink/20 bg-card px-3 py-2 text-sm text-ink shadow-[var(--shadow-paper)] hover:border-ink/40"
          aria-label={`Open guided demo: ${doneCount} of ${STEPS.length} done${next ? `, next: ${next.title}` : ""}`}
        >
          <Compass className="size-4 shrink-0 text-redpen" aria-hidden="true" />
          <span className="font-mono text-xs text-ink-soft">
            {doneCount}/{STEPS.length}
          </span>
          <span className="hidden truncate font-medium sm:inline">{next ? `Next: ${next.title}` : "Demo complete"}</span>
          <span className="font-medium sm:hidden">Demo</span>
          <ChevronUp className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </button>
        <style>{`.demo-flash{animation:demo-flash ${FLASH_MS}ms ease forwards}@keyframes demo-flash{0%{opacity:0;transform:translateY(4px)}10%,75%{opacity:1;transform:none}100%{opacity:0}}@media (prefers-reduced-motion: reduce){.demo-flash{animation:demo-flash-r ${FLASH_MS}ms linear forwards}@keyframes demo-flash-r{0%,80%{opacity:1}100%{opacity:0}}}`}</style>
      </div>
    );
  }

  return (
    <aside
      aria-label="Guided demo"
      className="paper-card fixed bottom-16 left-4 z-40 flex max-h-[40vh] sm:bottom-4 w-[min(18.75rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
    >
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <Compass className="size-4 text-redpen" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Guided demo</h2>
        <span className="font-mono text-xs text-ink-soft">
          {doneCount}/{STEPS.length}
        </span>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={() => setCollapsed(true)} className="rounded-md p-1 text-ink-soft hover:bg-accent hover:text-ink" aria-label="Minimise guided demo">
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={close} className="rounded-md p-1 text-ink-soft hover:bg-accent hover:text-ink" aria-label="Close guided demo">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-3 h-1 shrink-0 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <div className="h-full bg-redpen transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {next ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-redpen">
              Step {nextIdx + 1} of {STEPS.length}
            </p>
            <div className="mt-0.5 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-ink">{next.title}</p>
              {goButton(next, true)}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{next.hint}</p>
          </div>
        ) : (
          <p className="text-sm font-medium text-mastery-high">Demo complete. Thanks for looking!</p>
        )}

        {showAll && (
          <ol className="mt-3 space-y-1 border-t border-dashed border-border pt-2">
            {STEPS.map((s, i) => {
              const isDone = done.includes(s.id);
              return (
                <li key={s.id} className="flex items-center gap-2 py-0.5">
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                      isDone ? "border-mastery-high bg-mastery-high text-white" : i === nextIdx ? "border-redpen text-redpen" : "border-ink/30 text-ink-soft",
                    )}
                    aria-hidden="true"
                  >
                    {isDone ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-xs", isDone ? "text-ink-soft line-through decoration-ink/30" : "text-ink")}>
                    {s.title}
                    <span className="sr-only">{isDone ? " (done)" : ""}</span>
                  </span>
                  {!isDone && i !== nextIdx && goButton(s, false)}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-dashed border-border px-3 py-1.5 text-xs">
        <button type="button" onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 text-ink-soft hover:text-ink" aria-expanded={showAll}>
          <List className="size-3" aria-hidden="true" />
          {showAll ? "Hide steps" : "Show all steps"}
        </button>
        <button type="button" onClick={restart} className="inline-flex items-center gap-1 text-ink-soft hover:text-ink">
          <RotateCcw className="size-3" aria-hidden="true" />
          Restart
        </button>
      </footer>
    </aside>
  );
}
