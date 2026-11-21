"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Check,
  Cog,
  FilePlus2,
  GraduationCap,
  MessageCircleHeart,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AgentRunRow, UnderTheHoodData } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/* ── agent meta ─────────────────────────────────────────────── */

export const AGENT_META: Record<string, { name: string; Icon: LucideIcon }> = {
  diagnostician: { name: "Diagnostician", Icon: Stethoscope },
  detective: { name: "Detective", Icon: ScanSearch },
  planner: { name: "Planner", Icon: Route },
  generator: { name: "Generator", Icon: FilePlus2 },
  verifier: { name: "Verifier", Icon: ShieldCheck },
  coach: { name: "Coach", Icon: MessageCircleHeart },
  teacher_analyst: { name: "Teacher analyst", Icon: GraduationCap },
  learner_model: { name: "Learner model", Icon: Activity },
};

export function agentMeta(id: string) {
  if (AGENT_META[id]) return AGENT_META[id];
  const pretty = id.replace(/_/g, " ");
  return { name: pretty.charAt(0).toUpperCase() + pretty.slice(1), Icon: Cog };
}

type Tier = "Flash" | "Pro" | "code";

const AGENTS: { id: string; role: string; tiers: Tier[]; note: string }[] = [
  {
    id: "detective",
    role: "Reads rough work and finds the exact line where reasoning went off on a tangent, then names the misconception.",
    tiers: ["Pro", "Flash"],
    note: "Pro reads handwriting (vision); Flash diagnoses with teacher few-shots.",
  },
  {
    id: "diagnostician",
    role: "Runs the 12-question adaptive diagnostic: picks the most uncertain, highest-weight concept; steps down to a prerequisite after a miss.",
    tiers: ["code", "Flash"],
    note: "Question choice is deterministic; Flash writes the summary.",
  },
  {
    id: "planner",
    role: "Scores every possible next move (contrast, prerequisite drill, review, practice, stretch) and picks the best.",
    tiers: ["code", "Flash"],
    note: "A deterministic scorer decides; Flash writes “Why this question?”.",
  },
  {
    id: "generator",
    role: "Writes fresh CAT-style questions at a target Elo, with distractors built from real misconceptions.",
    tiers: ["Flash"],
    note: "Runs in the background to keep the pool full.",
  },
  {
    id: "verifier",
    role: "Solves each generated question blind, without the key, and rejects anything that doesn't match.",
    tiers: ["Pro"],
    note: "Rejections go back to the generator with a reason (max 2 retries).",
  },
  {
    id: "coach",
    role: "Feedback in a mentor's voice: margin notes, the Skip Coach insight, weekly summaries, “Back on the curve”.",
    tiers: ["Flash"],
    note: "Language only; never decides mastery.",
  },
  {
    id: "teacher_analyst",
    role: "Turns class aggregates into a Monday lesson plan: top gaps, the shared misconception, worked examples, groupings.",
    tiers: ["code", "Pro"],
    note: "Grouping and question set are deterministic; Pro writes the lesson.",
  },
];

function TierChip({ t }: { t: Tier }) {
  if (t === "code")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ink/30 bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink">
        <Cog className="size-3" aria-hidden="true" /> no AI: deterministic
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-redpen/40 bg-redpen/8 px-2 py-0.5 text-[11px] font-medium text-redpen">
      <Sparkles className="size-3" aria-hidden="true" /> Gemini {t}
    </span>
  );
}

export const fmtMs = (ms: number | null | undefined) => (ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

export function AgentCards({ perAgent }: { perAgent: UnderTheHoodData["perAgent"] }) {
  const by = new Map(perAgent.map((a) => [a.agent, a]));
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {AGENTS.map((a, i) => {
        const m = agentMeta(a.id);
        const s = by.get(a.id);
        const err = s ? Math.round(s.errorRate * 100) : null;
        return (
          <li key={a.id} className="paper-card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/20 bg-paper">
                  <m.Icon className="size-4 text-ink" aria-hidden="true" />
                </span>
                <h3 className="text-xl leading-none">{m.name}</h3>
              </div>
              <span className="font-mono text-xs text-ink-soft">#{i + 1}</span>
            </div>
            <p className="mt-3 text-sm text-ink">{a.role}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.tiers.map((t) => (
                <TierChip key={t} t={t} />
              ))}
            </div>
            <p className="mt-2 font-hand text-lg leading-tight text-ink-soft">{a.note}</p>
            <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-dashed border-ink/20 pt-3 text-center">
              <div>
                <dt className="text-[11px] text-ink-soft">runs</dt>
                <dd className="font-mono text-base text-ink tabular-nums">{s?.runs ?? 0}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-soft">avg latency</dt>
                <dd className="font-mono text-base text-ink tabular-nums">{fmtMs(s?.avgMs)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-soft">errors</dt>
                <dd className={cn("font-mono text-base tabular-nums", err != null && err >= 10 ? "text-redpen" : "text-ink")}>
                  {err == null ? "—" : `${err}%`}
                  {err != null && err >= 10 && <TriangleAlert className="ml-1 inline size-3.5 align-[-2px]" aria-label="high" />}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/* ── algorithms ─────────────────────────────────────────────── */

const ALGOS: { name: string; tag: string; body: React.ReactNode; formula: string }[] = [
  {
    name: "Bayesian Knowledge Tracing",
    tag: "mastery",
    body: (
      <>
        Each concept holds a probability you&apos;ve mastered it. A right answer raises it, but allows for a lucky <em>guess</em>; a wrong one lowers it, but
        allows for a careless <em>slip</em>. A right answer with wrong reasoning counts as half a miss. A right answer that took over 1.5× the target time only
        counts 70%: speed is part of CAT mastery.
      </>
    ),
    formula: "P(L|✓) = P(L)(1−S) / [P(L)(1−S) + (1−P(L))·G]\nP(L′) = P(L|obs) + (1−P(L|obs))·T",
  },
  {
    name: "Elo ratings",
    tag: "difficulty",
    body: (
      <>
        Questions and students sit on one scale, like chess players. Every attempt updates both, so a question&apos;s difficulty is calibrated by every
        student who tries it. We serve questions you have a <strong>60–70%</strong> chance of getting right: hard enough to learn from, not hard enough to
        demoralise.
      </>
    ),
    formula: "P(✓) = 1 / (1 + 10^((q − s)/400))\ntarget: q ≈ s − 108",
  },
  {
    name: "FSRS spaced repetition",
    tag: "forgetting",
    body: (
      <>
        A forgetting curve per concept (and per active misconception). It predicts when your recall drops, schedules the review just before that, and fades
        the concept&apos;s node on your map as it becomes due.
      </>
    ),
    formula: "R(t) = (1 + 19/81 · t/S)^−0.5\nreview when R(t) ≈ 0.9",
  },
  {
    name: "Confidence calibration",
    tag: "self-knowledge",
    body: (
      <>
        Before submitting you say Guessing, Fairly sure or Certain. We compare that with how often you&apos;re actually right. “Certain and wrong” raises the
        misconception prior and feeds the Skip Coach.
      </>
    ),
    formula: "gap = mean(conf) − accuracy\nconf: guess .33 · fair .66 · certain 1",
  },
];

export function Algorithms() {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {ALGOS.map((a) => (
        <li key={a.name} className="paper-card flex flex-col p-5">
          <p className="font-hand text-lg leading-none text-redpen">{a.tag}</p>
          <h3 className="mt-1 text-2xl">{a.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{a.body}</p>
          <div className="mt-auto pt-4">
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-dashed border-ink/25 bg-paper px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">
              {a.formula}
            </pre>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── detective eval + verifier ──────────────────────────────── */

const asCount = (acc: number, cases: number) => (acc <= 1 ? Math.round(acc * cases) : Math.round(acc));

export function DetectiveEval({ ev, ranAtLabel }: { ev: UnderTheHoodData["eval"]; ranAtLabel: string | null }) {
  if (!ev) {
    return (
      <div className="paper-card p-5">
        <h3 className="text-2xl">Detective evaluation</h3>
        <p className="margin-note mt-3">No eval run recorded yet. Run scripts/eval-detective.ts to score it.</p>
      </div>
    );
  }
  const mis = asCount(ev.misconceptionAccuracy, ev.cases);
  const line = asCount(ev.errorLineAccuracy, ev.cases);
  const both = asCount(ev.bothAccuracy, ev.cases);
  return (
    <div className="paper-card relative overflow-hidden p-5">
      <div className="flex items-center gap-2">
        <ScanSearch className="size-5 text-redpen" aria-hidden="true" />
        <h3 className="text-2xl">Detective evaluation</h3>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-4xl font-semibold text-ink tabular-nums sm:text-5xl">
            {mis}
            <span className="text-2xl text-ink-soft">/{ev.cases}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">misconceptions named correctly</p>
        </div>
        <div>
          <p className="font-mono text-4xl font-semibold text-redpen tabular-nums sm:text-5xl">
            {line}
            <span className="text-2xl text-ink-soft">/{ev.cases}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">exact error line found</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink">
        Both right on <span className="font-mono">{both}/{ev.cases}</span>.
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <div className="flex gap-1">
          <dt>model</dt>
          <dd className="font-mono text-ink">{ev.model ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt>avg latency</dt>
          <dd className="font-mono text-ink">{fmtMs(ev.avgMs)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>run</dt>
          <dd className="font-mono text-ink">{ranAtLabel ?? "—"}</dd>
        </div>
      </dl>
      <p className="margin-note mt-3 text-lg">Honest caveat: on {ev.cases} labelled typed solutions; handwriting is harder.</p>
    </div>
  );
}

export function VerifierCard({ v }: { v: UnderTheHoodData["verifier"] }) {
  const total = v.accepted + v.rejected;
  const rate = Math.round((v.rejectionRate <= 1 ? v.rejectionRate : v.rejectionRate / 100) * 100);
  const maxN = Math.max(1, ...v.topReasons.map((r) => r.n));
  return (
    <div className="paper-card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-ink" aria-hidden="true" />
        <h3 className="text-2xl">Verifier</h3>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="font-mono text-4xl font-semibold text-redpen tabular-nums sm:text-5xl">{total ? `${rate}%` : "—"}</p>
        <p className="pb-1 text-sm text-ink-soft">of generated drafts rejected before any student saw them</p>
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div className="flex h-3 overflow-hidden rounded-full border border-ink/20" aria-hidden="true">
            <div className="bg-mastery-high" style={{ width: `${(v.accepted / total) * 100}%` }} />
            <div className="tg-reject-hatch" style={{ width: `${(v.rejected / total) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-mastery-high">
              <Check className="inline size-3.5 align-[-2px]" aria-hidden="true" /> accepted <span className="font-mono">{v.accepted}</span>
            </span>
            <span className="text-redpen">
              <X className="inline size-3.5 align-[-2px]" aria-hidden="true" /> rejected <span className="font-mono">{v.rejected}</span>
            </span>
          </p>
        </div>
      )}

      {v.topReasons.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">Top rejection reasons</p>
          <ul className="mt-2 space-y-1.5">
            {v.topReasons.slice(0, 5).map((r) => (
              <li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
                <span className="truncate text-ink" title={r.reason}>
                  {r.reason}
                </span>
                <span className="font-mono text-xs text-ink-soft tabular-nums">×{r.n}</span>
                <span className="col-span-2 h-1 rounded-full bg-redpen/70" style={{ width: `${(r.n / maxN) * 100}%` }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 rounded-lg bg-highlighter/60 px-3 py-2 text-sm text-ink">
        <span className="font-mono font-semibold">{v.generatedLive}</span> questions generated + verified in the background while you practise.
      </p>
    </div>
  );
}

/* ── feedback loops ─────────────────────────────────────────── */

const LOOPS: { name: string; what: string; where: string; href: string }[] = [
  { name: "Answer loop", what: "answer → mastery & Elo update → planner picks the next move", where: "Practice · trace panel", href: "/practice" },
  { name: "Misconception lifecycle", what: "detected → fixing → resolved after 2 clean answers; reopens on recurrence", where: "Mistake Journal", href: "/mistakes" },
  { name: "Generator ⇄ verifier", what: "drafts rejected with a reason, retried, or swapped for a bank question", where: "Practice trace · Verifier card above", href: "/practice" },
  { name: "Question calibration", what: "question Elo moves with every student; flagged or drifting questions retire", where: "Practice trace · learner model step", href: "/practice" },
  { name: "Forgetting", what: "FSRS due dates → nodes fade on the map → review queue", where: "Concept map · Today", href: "/map" },
  { name: "Confidence", what: "confidently wrong raises misconception priors and feeds the Skip Coach", where: "Strategy", href: "/strategy" },
  { name: "Student disagreement", what: "“That's not why I got it wrong” → detective re-runs with your context", where: "Practice · after a diagnosis", href: "/practice" },
  { name: "Teacher correction → few-shot", what: "a teacher relabels a diagnosis → the detective learns from it", where: "Teacher · override queue", href: "/teacher" },
  { name: "Class impact", what: "assignments store baseline mastery and show the before/after lift", where: "Teacher · assignments", href: "/teacher" },
  { name: "Plan", what: "the daily plan regenerates after each session", where: "Today", href: "/today" },
];

export function Loops() {
  return (
    <ol className="paper-card tg-notebook grid gap-x-8 py-3 pr-4 pl-6 sm:pl-14 md:grid-cols-2">
      {LOOPS.map((l, i) => (
        <li key={l.name} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-b border-dashed border-ink/15 py-2.5 last:border-0 md:[&:nth-last-child(2)]:border-0">
          <span className="font-mono text-sm leading-6 text-redpen tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <p className="font-medium text-ink">{l.name}</p>
            <p className="text-sm text-ink-soft">{l.what}</p>
            <Link href={l.href} className="mt-0.5 inline-flex items-center gap-0.5 font-hand text-lg leading-tight text-redpen underline-offset-4 hover:underline">
              see it: {l.where}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── live feed ──────────────────────────────────────────────── */

const STATUS: Record<string, { label: string; Icon: LucideIcon; cls: string }> = {
  ok: { label: "ok", Icon: Check, cls: "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" },
  fallback: { label: "fallback", Icon: Undo2, cls: "border-mastery-mid/60 bg-mastery-mid/15 text-amber-ink" },
  rejected: { label: "rejected", Icon: X, cls: "border-redpen/50 bg-redpen/10 text-redpen" },
  error: { label: "error", Icon: TriangleAlert, cls: "border-redpen bg-redpen/15 text-redpen" },
};

export function relTime(iso: string, now: number | null) {
  if (now == null) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function FeedRow({ r, now }: { r: AgentRunRow; now: number | null }) {
  const m = agentMeta(r.agent);
  const st = STATUS[r.status] ?? { label: r.status, Icon: Cog, cls: "border-border text-ink-soft" };
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)_4.5rem_5.5rem_5rem] sm:items-center">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/20 bg-paper px-2 py-0.5 text-xs font-medium text-ink">
        <m.Icon className="size-3.5" aria-hidden="true" />
        {m.name}
      </span>
      <span className="text-right text-xs text-ink-soft sm:order-last">{relTime(r.createdAt, now)}</span>
      <span className="col-span-2 min-w-0 text-sm text-ink sm:col-span-1">{r.summary}</span>
      <span className="font-mono text-xs text-ink tabular-nums sm:text-right">{fmtMs(r.latencyMs)}</span>
      <span className={cn("inline-flex w-fit items-center gap-1 justify-self-end rounded-full border px-2 py-0.5 text-[11px] font-medium sm:justify-self-start", st.cls)}>
        <st.Icon className="size-3" aria-hidden="true" />
        {st.label}
      </span>
    </li>
  );
}

/* ── counts ─────────────────────────────────────────────────── */

export function Counts({ c }: { c: UnderTheHoodData["counts"] }) {
  const items: [string, number][] = [
    ["concepts", c.concepts],
    ["misconceptions", c.misconceptions],
    ["questions", c.questions],
    ["students", c.students],
    ["attempts", c.attempts],
    ["teacher corrections", c.teacherCorrections],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, n]) => (
        <div key={label} className="flex flex-col bg-card px-4 py-3">
          <dt className="order-2 text-xs text-ink-soft">{label}</dt>
          <dd className="order-1 font-mono text-2xl text-ink tabular-nums sm:text-3xl">{n.toLocaleString("en-IN")}</dd>
        </div>
      ))}
    </dl>
  );
}
