"use client";

import { ScheduleDoubtClass } from "./doubt-classes";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, ClipboardCheck, NotebookPen, RefreshCw, Users } from "lucide-react";
import type { AssignmentRow, LessonPlan } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";
import { PenLoader } from "@/components/tangent/pen-loader";
import { TracePanel } from "@/components/tangent/trace-panel";
import { cn } from "@/lib/utils";
import { postJson } from "./shared";
import { markDemoStep } from "@/components/tangent/demo-guide/events";

const CAPTIONS = [
  "Reading 31 students' mistakes…",
  "Grouping the misconceptions…",
  "Finding the class-wide gaps…",
  "Drafting worked examples…",
  "Marking the wrong way in red…",
  "Picking a question set…",
];

function RotatingLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % CAPTIONS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tg-notebook flex min-h-48 flex-col items-start justify-center gap-2 rounded-xl border px-6 py-8 sm:pl-14">
      <PenLoader label={CAPTIONS[i]} />
      <p className="text-xs text-ink-soft">The teacher analyst usually takes 15–40 seconds.</p>
    </div>
  );
}

function Gap({ g, i }: { g: LessonPlan["gaps"][number]; i: number }) {
  return (
    <section className="flex flex-col gap-3 border-b border-dashed border-ink/20 pb-6 last:border-b-0 last:pb-0" aria-labelledby={`gap-${i}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-hand text-2xl leading-none text-redpen">{i + 1}.</span>
        <h4 id={`gap-${i}`} className="font-serif text-2xl text-ink">
          {g.title}
        </h4>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-ink-soft">
          <Users className="size-3" aria-hidden="true" />
          <span className="font-mono tabular-nums text-ink">{g.studentsAffected}</span> affected
        </span>
      </div>
      <p className="text-xs text-ink-soft">
        <span className="font-mono">{g.conceptId}</span> {g.conceptName}
        {g.misconceptionName && <> · {g.misconceptionName}</>}
      </p>
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-semibold">Why it happens: </span>
        <MathText text={g.whyItHappens} />
      </p>

      <div className="rounded-lg border bg-paper/60 p-3">
        <p className="mb-2 text-sm text-ink">
          <span className="font-semibold">Worked example: </span>
          <MathText text={g.workedExample.problem} />
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-redpen/30 bg-redpen/5 p-2.5">
            <p className="mb-1 text-sm font-medium leading-none text-redpen">✗ the tangent</p>
            <p className="tg-strike text-sm text-ink-soft">
              <MathText text={g.workedExample.wrongWay} />
            </p>
          </div>
          <div className="rounded-md border border-mastery-high/40 bg-mastery-high/5 p-2.5">
            <p className="mb-1 text-sm font-medium leading-none text-mastery-high">✓ back on the curve</p>
            <p className="text-sm text-ink">
              <MathText text={g.workedExample.rightWay} />
            </p>
          </div>
        </div>
      </div>

      <p className="margin-note">
        <span className="text-ink-soft">Teaching move → </span>
        {g.teachingMove}
      </p>
    </section>
  );
}

export function LessonPlanCard({ onAssigned }: { onAssigned: (a: AssignmentRow) => void }) {
  const reduced = useReducedMotion();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ state: "idle" | "busy" | "done" | "error"; msg?: string }>({ state: "idle" });
  const [traceOpen, setTraceOpen] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const p = await postJson<LessonPlan>("/api/teacher/lesson-plan");
      setPlan(p);
      markDemoStep("lesson");
      setAssign({ state: "idle" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function assignTop() {
    const conceptId = plan?.gaps[0]?.conceptId;
    if (!conceptId) return;
    setAssign({ state: "busy" });
    try {
      const row = await postJson<AssignmentRow>("/api/teacher/assign", { conceptId });
      onAssigned(row);
      setAssign({ state: "done", msg: `Assigned ${row.questionCount} questions on ${row.conceptName}. Baseline locked at ${row.baseline == null ? "—" : Math.round(row.baseline * 100) + "%"}.` });
    } catch (e) {
      setAssign({ state: "error", msg: `Couldn't assign (${(e as Error).message}).` });
    }
  }

  if (loading) return <RotatingLoader />;

  if (!plan)
    return (
      <div className="tg-notebook flex flex-col items-start gap-3 rounded-xl border px-5 py-8 sm:pl-14">
        <p className="font-hand text-2xl leading-tight text-ink">Monday, first period. What does this class need most?</p>
        <p className="max-w-prose text-sm text-ink-soft">
          The teacher analyst reads every student&apos;s open misconceptions, picks the class-wide gaps, and drafts a worked example and a teaching
          move for each, plus student groups and a question set you can assign.
        </p>
        <Button size="lg" onClick={generate}>
          <NotebookPen aria-hidden="true" /> Generate Monday&apos;s lesson plan
        </Button>
        {error && (
          <p className="text-sm text-redpen" role="alert">
            The analyst couldn&apos;t finish ({error}). Try again in a moment.
          </p>
        )}
      </div>
    );

  const top = plan.gaps[0];

  return (
    <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-4">
      <article className="tg-notebook flex flex-col gap-6 rounded-xl border px-4 py-6 sm:pr-8 sm:pl-14" aria-label="Monday lesson plan">
        <header className="flex flex-col gap-1">
          <p className="font-hand text-xl leading-none text-redpen">Monday&apos;s lesson</p>
          <h3 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">{plan.headline}</h3>
        </header>

        {plan.gaps.map((g, i) => (
          <Gap key={`${g.conceptId}-${i}`} g={g} i={i} />
        ))}

        {plan.groups.length > 0 && (
          <section aria-labelledby="plan-groups" className="flex flex-col gap-3">
            <h4 id="plan-groups" className="hand-underline self-start font-serif text-2xl text-ink">
              Seat them like this
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plan.groups.map((g) => (
                <div key={g.label} className="paper-card p-3">
                  <p className="font-medium text-ink">{g.label}</p>
                  <p className="text-sm font-medium leading-tight text-redpen">{g.focus}</p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {g.students.map((s) => (
                      <li key={s} className="rounded-full border bg-paper px-2 py-0.5 text-xs text-ink">
                        {s}
                      </li>
                    ))}
                  </ul>
                  <ScheduleDoubtClass studentNames={g.students} defaultTitle={`Doubt class: ${g.focus}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {plan.questionSet.length > 0 && (
          <section aria-labelledby="plan-qs" className="flex flex-col gap-3">
            <h4 id="plan-qs" className="hand-underline self-start font-serif text-2xl text-ink">
              Question set
            </h4>
            <ol className="flex flex-col gap-2">
              {plan.questionSet.map((q, i) => (
                <li key={q.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm text-ink">
                  <span className="font-mono text-ink-soft">Q{i + 1}</span>
                  <span>
                    <MathText text={q.stem} />
                    <span className="ml-2 font-mono text-[0.65rem] text-ink-soft">{q.conceptId}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4">
          {top && (
            <Button size="lg" onClick={assignTop} disabled={assign.state === "busy" || assign.state === "done"}>
              <ClipboardCheck aria-hidden="true" />
              {assign.state === "busy" ? "Assigning…" : assign.state === "done" ? "Assigned" : `Assign this set (${top.conceptName})`}
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={generate}>
            <RefreshCw aria-hidden="true" /> Regenerate
          </Button>
          <span className="ml-auto font-mono text-xs text-ink-soft" suppressHydrationWarning>
            drafted {new Date(plan.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {assign.msg && (
          <p role="status" className={cn("text-sm", assign.state === "error" ? "text-redpen" : "text-mastery-high")}>
            {assign.msg} {assign.state === "done" && <span className="text-sm font-medium text-ink-soft">Watch its lift under Assignments.</span>}
          </p>
        )}
        {error && (
          <p className="text-sm text-redpen" role="alert">
            Regenerate failed ({error}). Showing the previous plan.
          </p>
        )}
      </article>

      <div className="paper-card">
        <button
          type="button"
          onClick={() => setTraceOpen((o) => !o)}
          aria-expanded={traceOpen}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left"
        >
          <span className="font-serif text-xl text-ink">Under the hood</span>
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            {plan.trace.length} step{plan.trace.length === 1 ? "" : "s"}
            <ChevronDown className={cn("size-4 transition-transform", traceOpen && "rotate-180")} aria-hidden="true" />
          </span>
        </button>
        {traceOpen && (
          <div className="border-t px-4 pt-3 pb-1">
            <TracePanel steps={plan.trace} running={false} title={null} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
