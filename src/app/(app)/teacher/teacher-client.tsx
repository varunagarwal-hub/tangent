"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, GraduationCap, RefreshCw, Sparkles } from "lucide-react";
import type { AssignmentRow, TeacherClassData } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { PenLoader } from "@/components/tangent/pen-loader";
import { Heatmap } from "@/components/tangent/teacher/heatmap";
import { Leaderboard } from "@/components/tangent/teacher/leaderboard";
import { LessonPlanCard } from "@/components/tangent/teacher/lesson-plan";
import { OverrideQueue } from "@/components/tangent/teacher/override-queue";
import { Assignments } from "@/components/tangent/teacher/assignments";
import { StudentSheet } from "@/components/tangent/teacher/student-sheet";
import { SectionHeading, fetchJson, pct } from "@/components/tangent/teacher/shared";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/tangent/page-intro";
import { InfoTip } from "@/components/tangent/info-tip";
import type { GlossaryTerm } from "@/lib/glossary";

function Kpi({ label, value, note, tone = "ink", tip }: { label: string; value: string; note?: string; tone?: "ink" | "red"; tip?: GlossaryTerm }) {
  return (
    <div className="paper-card relative flex flex-col gap-1 overflow-hidden px-4 py-3">
      <span className="flex items-center gap-1 text-sm text-ink-soft">
        {label}
        {tip && <InfoTip term={tip} />}
      </span>
      <span className={cn("font-mono text-3xl tabular-nums sm:text-4xl", tone === "red" ? "text-redpen" : "text-ink")}>{value}</span>
      {note && <span className={cn("text-sm font-medium leading-tight", tone === "red" ? "text-redpen" : "text-ink-soft")}>{note}</span>}
    </div>
  );
}

function CorrectionsBadge({ n }: { n: number }) {
  const reduced = useReducedMotion();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-redpen/40 bg-redpen/8 px-3 py-1 text-sm text-ink"
      aria-live="polite"
    >
      <Sparkles className="size-3.5 text-redpen" aria-hidden="true" />
      Detective learned from{" "}
      <span className="relative inline-flex min-w-[1ch] justify-center overflow-hidden font-mono font-semibold text-redpen tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={n}
            initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </span>{" "}
      teacher correction{n === 1 ? "" : "s"}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PenLoader label="Opening the class register…" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="paper-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="paper-card h-80 animate-pulse" />
    </div>
  );
}

export function TeacherClient() {
  const [data, setData] = useState<TeacherClassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [freshAssignment, setFreshAssignment] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(true);

  const load = useCallback(() => {
    setError(null);
    fetchJson<TeacherClassData>("/api/teacher/class")
      .then((d) => {
        setData(d);
        setCorrections(d.teacherCorrections);
        setAssignments(d.assignments);
      })
      .catch((e: unknown) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onAssigned = useCallback((row: AssignmentRow) => {
    setAssignments((rows) => [row, ...rows.filter((r) => r.id !== row.id)]);
    setFreshAssignment(row.id);
  }, []);

  if (error && !data)
    return (
      <div className="paper-card mx-auto flex max-w-lg flex-col items-start gap-3 p-6">
        <h1 className="text-3xl text-ink">The register didn&apos;t open</h1>
        <p className="text-sm text-ink-soft">Couldn&apos;t load the class ({error}).</p>
        <Button onClick={load}>
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      </div>
    );

  if (!data) return <Skeleton />;

  const k = data.kpis;
  const atRiskNames = data.students.filter((s) => s.atRisk).map((s) => s.name);

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        id="teacher"
        steps={[
          "Scan the heatmap for red columns: concepts the whole batch is weak on.",
          "The leaderboard names the misconception behind each gap; generate Monday's lesson plan around them.",
          "Confirm or relabel unsure diagnoses in the override queue to teach the Detective.",
        ]}
      />
      {/* 1. header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-hand text-xl leading-none text-redpen">
              <GraduationCap className="size-4" aria-hidden="true" /> Prof. Mehta&apos;s register
            </p>
            <h1 className="hand-underline mt-2 text-4xl text-ink sm:text-5xl">{data.class.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <span>Class</span>
              <span className="relative">
                <select
                  className="appearance-none rounded-lg border bg-card py-1.5 pr-8 pl-3 text-sm text-ink"
                  value={data.class.id}
                  onChange={() => {}}
                  aria-describedby="class-only-one"
                >
                  <option value={data.class.id}>{data.class.name}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              </span>
              <span id="class-only-one" className="sr-only">
                Only one class is set up
              </span>
            </label>
            <span className="inline-flex items-center gap-1">
              <CorrectionsBadge n={corrections} />
              <InfoTip term="detectiveLearned" />
            </span>
          </div>
        </div>

        {/* 2. KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Students" value={String(k.students)} note="in this batch" />
          <Kpi label="Average mastery" value={pct(k.avgMastery)} note="across tested concepts" />
          <Kpi label="Active misconceptions" value={String(k.activeMisconceptions)} note="detected or fixing" />
          <Kpi
            label="At-risk students"
            tip="atRisk"
            value={String(k.atRisk)}
            tone="red"
            note={atRiskNames.length ? `${atRiskNames.slice(0, 2).join(", ")}${atRiskNames.length > 2 ? ` +${atRiskNames.length - 2}` : ""}` : "none flagged"}
          />
        </div>
      </header>

      {/* 3. heatmap */}
      <section aria-labelledby="heat-h" className="flex min-w-0 flex-col gap-4">
        <SectionHeading
          id="heat-h"
          kicker="who knows what"
          title={<span className="inline-flex items-center gap-1.5">Class heatmap <InfoTip term="heatmap" /></span>}
          aside={<p className="text-sm text-ink-soft">Click a name to open their notebook. Click a concept id to sort by it.</p>}
        />
        <div className="paper-card min-w-0 p-3 sm:p-4">
          <Heatmap data={data} onOpenStudent={setStudentId} />
        </div>
      </section>

      {/* 4 + 7. leaderboard and assignments side by side on desktop */}
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
        <section aria-labelledby="lb-h" className="flex min-w-0 flex-col gap-4">
          <SectionHeading id="lb-h" kicker="what keeps going wrong" title={<span className="inline-flex items-center gap-1.5">Misconception leaderboard <InfoTip term="leaderboard" /></span>} />
          <div className="paper-card px-4 py-2">
            <Leaderboard rows={data.leaderboard} />
          </div>
        </section>
        <section aria-labelledby="as-h" className="flex min-w-0 flex-col gap-4">
          <SectionHeading id="as-h" kicker="did it work?" title="Assignments & impact" />
          <div className="paper-card px-4 py-2">
            <p className="border-b border-dashed py-2 text-sm font-medium text-ink-soft">
              Class mastery on the concept when assigned → now. Feedback loop 9.
            </p>
            <Assignments rows={assignments} freshId={freshAssignment} />
          </div>
        </section>
      </div>

      {/* 5. lesson plan */}
      <section aria-labelledby="lp-h" className="flex min-w-0 flex-col gap-4">
        <SectionHeading id="lp-h" kicker="plan the week" title="Monday lesson plan" />
        <LessonPlanCard onAssigned={onAssigned} />
      </section>

      {/* 6. override queue */}
      <section aria-labelledby="oq-h" className="flex min-w-0 flex-col gap-4">
        <SectionHeading
          id="oq-h"
          kicker="check the detective's homework"
          title={<span className="inline-flex items-center gap-1.5">Override queue <InfoTip term="overrideQueue" /></span>}
          aside={
            <button
              type="button"
              onClick={() => setQueueOpen((o) => !o)}
              aria-expanded={queueOpen}
              aria-controls="oq-body"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-soft hover:text-ink"
            >
              {queueOpen ? "Hide" : "Show"} <ChevronDown className={cn("size-4 transition-transform", queueOpen && "rotate-180")} aria-hidden="true" />
            </button>
          }
        />
        <p className="max-w-prose text-sm text-ink-soft">
          Low-confidence diagnoses from the last few days. Every confirm or relabel is saved as a worked example the detective reads before its next
          diagnosis on that misconception.
        </p>
        <div id="oq-body" hidden={!queueOpen}>
          <OverrideQueue items={data.overrideQueue} onCorrection={setCorrections} />
        </div>
      </section>

      {/* 8. drill-down */}
      <StudentSheet studentId={studentId} onClose={() => setStudentId(null)} />
    </div>
  );
}
