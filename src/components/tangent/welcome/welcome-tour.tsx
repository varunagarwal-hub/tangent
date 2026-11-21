"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  Grid3x3,
  Loader2,
  Map as MapIcon,
  NotebookPen,
  Sparkles,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { LS, TOUR_OPEN_EVENT, lsGet, lsSet, openDemoGuide, setPersona } from "../demo-guide/events";

type Role = "student" | "teacher";

interface TourStep {
  kicker: string;
  title: string;
  body: string;
  visual: "redpen" | LucideIcon;
}

const STUDENT_STEPS: TourStep[] = [
  {
    kicker: "Step 1",
    title: "Start with a quick diagnostic",
    body: "12 adaptive questions find what you already know and where your foundations are shaky. Or skip it and explore Riya's account, which already has two weeks of practice in it.",
    visual: ClipboardList,
  },
  {
    kicker: "Step 2",
    title: "Show your rough work",
    body: "Type it, draw it, or snap a photo of your notebook. When an answer goes wrong, Tangent circles the exact line where your reasoning went off on a tangent and explains why, like a mentor's red pen.",
    visual: "redpen",
  },
  {
    kicker: "Step 3",
    title: "See what to fix",
    body: "Your Mastery Map colours all 27 CAT Quant concepts from red to green. Your Mistake Journal tracks each misconception until you've proved, on fresh questions, that it's fixed.",
    visual: MapIcon,
  },
  {
    kicker: "Step 4",
    title: "Let the plan pick your next question",
    body: "Every answer updates your plan: a question built to test a live mistake, a prerequisite to shore up, or a review just before you'd forget it.",
    visual: CalendarClock,
  },
];

const TEACHER_STEPS: TourStep[] = [
  {
    kicker: "Step 1",
    title: "See your whole batch at once",
    body: "A heatmap of every student against every concept. Red cells are gaps, so you can spot who needs help on what without grading a single mock.",
    visual: Grid3x3,
  },
  {
    kicker: "Step 2",
    title: "Find the class-wide mistakes",
    body: "The misconception leaderboard shows which wrong ideas are shared across the class, like adding successive percentages, and whether they're growing or shrinking.",
    visual: Trophy,
  },
  {
    kicker: "Step 3",
    title: "Plan Monday's class in a minute",
    body: "Generate a lesson plan built around the top three gaps, with a worked wrong-vs-right example for each, then assign a targeted question set in one click.",
    visual: BookOpenCheck,
  },
  {
    kicker: "Step 4",
    title: "Teach the Detective",
    body: "When the AI isn't sure why a student went wrong, it asks you. Your correction becomes an example it learns from for every future student.",
    visual: NotebookPen,
  },
];

function RedPenVisual() {
  return (
    <div className="w-full max-w-[16rem] space-y-1.5 text-left font-hand text-xl leading-tight text-ink" aria-hidden="true">
      <p>1. MP = ₹2000</p>
      <p className="relative w-fit">
        2. Discount = 20% + 10% = 30%
        <svg className="pointer-events-none absolute -left-2 -top-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+1rem)]" viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M6 22 C 4 6, 92 2, 96 18 C 99 34, 10 40, 4 24" fill="none" stroke="var(--redpen)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      </p>
      <p>3. SP = ₹1400</p>
      <p className="pt-1 text-lg text-redpen">← discounts multiply: 28%</p>
    </div>
  );
}

function StepVisual({ visual }: { visual: TourStep["visual"] }) {
  return (
    <div className="graph-paper flex h-40 items-center justify-center rounded-xl border border-border bg-paper sm:h-44">
      {visual === "redpen" ? (
        <RedPenVisual />
      ) : (
        (() => {
          const Icon = visual;
          return (
            <span className="relative grid size-20 place-items-center rounded-2xl border-2 border-ink/80 bg-card shadow-[var(--shadow-paper)]" aria-hidden="true">
              <Icon className="size-9 text-ink" strokeWidth={1.6} />
              <span className="absolute -right-2 -top-2 size-4 rounded-full bg-redpen" />
            </span>
          );
        })()
      )}
    </div>
  );
}

function RoleCard({ Icon, title, body, onClick }: { Icon: LucideIcon; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border-2 border-ink/15 bg-card p-5 text-left shadow-[var(--shadow-paper)] transition hover:border-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-redpen/50"
    >
      <span className="grid size-11 place-items-center rounded-full bg-ink text-paper">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-semibold text-ink">{title}</span>
      <span className="text-sm leading-relaxed text-ink-soft">{body}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-ink">
        Show me <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * First-visit welcome: "who are you?" → a 4-step plain-language walkthrough for that role →
 * sets the demo persona and lands on the right page. Re-open anywhere with `openTour()`.
 */
export function WelcomeTour({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState(0);
  const [withDemo, setWithDemo] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpen && lsGet(LS.tourSeen) !== "1") {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [autoOpen]);

  useEffect(() => {
    const onOpen = () => {
      setRole(null);
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, onOpen);
  }, []);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) lsSet(LS.tourSeen, "1");
  }

  async function finish(persona: "riya" | "mehta" | "new") {
    setBusy(persona);
    lsSet(LS.tourSeen, "1");
    try {
      await setPersona(persona);
      if (withDemo && persona !== "new") openDemoGuide();
      setOpen(false);
      router.push(persona === "mehta" ? "/teacher" : persona === "new" ? "/onboarding" : "/today");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const steps = role === "teacher" ? TEACHER_STEPS : STUDENT_STEPS;
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto bg-paper p-0 sm:max-w-2xl">
        {role === null ? (
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <LogoMark className="h-6" />
              <span className="font-hand text-2xl text-redpen">welcome</span>
            </div>
            <DialogTitle className="mt-2 font-serif text-4xl font-normal leading-tight text-ink sm:text-5xl">Welcome to Tangent. Who are you?</DialogTitle>
            <DialogDescription className="mt-3 text-base leading-relaxed text-ink-soft">
              Tangent is a CAT Quant tutor that checks your <strong className="font-medium text-ink">reasoning</strong>, not just your answer. Pick a role and
              we&apos;ll show you around in under a minute.
            </DialogDescription>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <RoleCard Icon={UserRound} title="I'm a student" body="Preparing for CAT. Practise, see exactly where your reasoning slips, and follow a plan built around it." onClick={() => setRole("student")} />
              <RoleCard Icon={GraduationCap} title="I'm a teacher" body="Running a batch. See everyone's gaps, the mistakes they share, and plan your next class around them." onClick={() => setRole("teacher")} />
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="mt-5 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
              Just exploring, skip the tour
            </button>
          </div>
        ) : (
          <div className="flex flex-col p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 pr-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {role === "student" ? "For students" : "For teachers"} · {current.kicker} of {steps.length}
              </p>
              <div className="flex gap-1.5" aria-hidden="true">
                {steps.map((_, i) => (
                  <span key={i} className={cn("h-1.5 w-6 rounded-full transition-colors", i <= step ? "bg-redpen" : "bg-ink/15")} />
                ))}
              </div>
            </div>

            <div key={`${role}-${step}`} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 duration-200">
              <div className="mt-4">
                <StepVisual visual={current.visual} />
              </div>
              <DialogTitle className="mt-5 font-serif text-3xl font-normal leading-tight text-ink">{current.title}</DialogTitle>
              <DialogDescription className="mt-2 text-base leading-relaxed text-ink-soft">{current.body}</DialogDescription>
            </div>

            {last && (
              <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-dashed border-border bg-card/60 p-3 text-sm text-ink">
                <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} className="mt-0.5 size-4 accent-[var(--redpen)]" />
                <span>
                  <span className="font-medium">Show me the guided demo</span>
                  <span className="block text-ink-soft">A small checklist in the corner walks you through the best parts, step by step.</span>
                </span>
              </label>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => (step === 0 ? setRole(null) : setStep(step - 1))}
                className="inline-flex items-center gap-1.5 self-start text-sm text-ink-soft hover:text-ink"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {step === 0 ? "Change role" : "Back"}
              </button>

              {!last ? (
                <button type="button" onClick={() => setStep(step + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 font-medium text-paper hover:opacity-90">
                  Next <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ) : role === "student" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => finish("new")}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-card px-4 py-3 font-medium text-ink hover:bg-accent disabled:opacity-60"
                  >
                    {busy === "new" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                    Start fresh: diagnostic
                  </button>
                  <button
                    type="button"
                    onClick={() => finish("riya")}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 font-medium text-paper hover:opacity-90 disabled:opacity-60"
                  >
                    {busy === "riya" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                    Try Riya&apos;s account <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => finish("mehta")}
                  disabled={busy !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 font-medium text-paper hover:opacity-90 disabled:opacity-60"
                >
                  {busy === "mehta" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Open Prof. Mehta&apos;s dashboard <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {last && role === "student" && (
              <p className="mt-3 text-xs text-ink-soft sm:text-right">The guided demo follows Riya&apos;s account; a fresh start begins with the diagnostic.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
