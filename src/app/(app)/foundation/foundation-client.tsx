"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Lock, RotateCcw, Unlock, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";
import { PenLoader } from "@/components/tangent/pen-loader";
import { cn } from "@/lib/utils";

type State = "solid" | "shaky" | "repaired" | "unchecked";
interface Skill {
  id: string;
  name: string;
  description: string;
  state: State;
  check: { correct: number; total: number } | null;
  unlocks: { id: string; name: string; p: number | null }[];
  stuck: string[];
}
interface Overview { checked: boolean; skills: Skill[] }
interface Q { id: string; skillId: string; stem: string; options: string[] }
interface Graded { id: string; skillId: string; correct: boolean; choice: number | null; answerIndex: number; explanation: string }
type Mode = { kind: "check" } | { kind: "repair"; skillId: string };
type Result =
  | { kind: "check"; graded: Graded[]; skills: { skillId: string; correct: number; total: number; status: "solid" | "shaky" }[] }
  | { kind: "repair"; skillId: string; graded: Graded[]; correct: number; total: number; passed: boolean };

const LETTERS = ["A", "B", "C", "D"];
const STATE_CHIP: Record<State, { label: string; cls: string }> = {
  solid: { label: "Solid", cls: "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" },
  repaired: { label: "Repaired · unlocked", cls: "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" },
  shaky: { label: "Shaky", cls: "border-redpen/40 bg-redpen/8 text-redpen" },
  unchecked: { label: "Not checked", cls: "border-border text-ink-soft" },
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function FoundationClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [choices, setChoices] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/foundation");
      if (!r.ok) throw new Error(String(r.status));
      setOverview(await r.json());
    } catch {
      setError("Couldn't load your foundations. Please try again.");
    }
  }, []);
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // relaxed timer: counts up, never cuts you off
  useEffect(() => {
    if (!mode || result) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 500);
    return () => clearInterval(t);
  }, [mode, result]);

  const begin = async (m: Mode) => {
    setBusy(true);
    setError(null);
    try {
      const url = m.kind === "check" ? "/api/foundation?set=check" : `/api/foundation?set=repair&skill=${m.skillId}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const d: { questions: Q[] } = await r.json();
      setQs(d.questions);
      setChoices(d.questions.map(() => null));
      setI(0);
      setResult(null);
      setMode(m);
      startedAt.current = Date.now();
      setElapsed(0);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Couldn't start. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (final: (number | null)[]) => {
    if (!mode) return;
    setBusy(true);
    try {
      const answers = qs.map((q, k) => ({ id: q.id, choice: final[k] }));
      const body = mode.kind === "check" ? { kind: "check", answers } : { kind: "repair", skillId: mode.skillId, answers };
      const r = await fetch("/api/foundation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setResult(mode.kind === "check" ? { kind: "check", ...d } : { kind: "repair", skillId: mode.skillId, ...d });
      void loadOverview();
      window.scrollTo({ top: 0 });
    } catch {
      setError("Couldn't save your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (c: number) => {
    if (!mode || busy) return;
    const next = [...choices];
    next[i] = c;
    setChoices(next);
    if (i + 1 < qs.length) setI(i + 1);
    else await submit(next);
  };

  // keyboard: A–D or 1–4
  useEffect(() => {
    if (!mode || result) return;
    const onKey = (e: KeyboardEvent) => {
      const k = "ABCD".indexOf(e.key.toUpperCase());
      const n = Number(e.key) - 1;
      const c = k >= 0 ? k : n >= 0 && n < 4 ? n : -1;
      if (c >= 0 && qs[i]?.options[c] != null) void choose(c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const skillName = (id: string) => overview?.skills.find((s) => s.id === id)?.name ?? id;

  if (error && !overview) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <p className="margin-note text-left">{error}</p>
        <Button className="mt-4" onClick={() => void loadOverview()}><RotateCcw className="size-4" /> Try again</Button>
      </div>
    );
  }
  if (!overview) return <PenLoader label="Checking the foundations…" className="mx-auto mt-16" />;

  /* ── results ── */
  if (mode && result) {
    if (result.kind === "repair") {
      const sk = overview.skills.find((s) => s.id === result.skillId);
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="paper-card p-6 text-center sm:p-8">
            {result.passed ? <Unlock className="mx-auto size-8 text-mastery-high" aria-hidden="true" /> : <Wrench className="mx-auto size-8 text-redpen" aria-hidden="true" />}
            <p className="mt-2 font-mono text-5xl text-ink">{result.correct}/{result.total}</p>
            <h1 className="mt-2 text-3xl">{result.passed ? `${skillName(result.skillId)}: repaired` : "Not quite yet"}</h1>
            <p className="mt-2 text-ink-soft">
              {result.passed
                ? `That unlocks ${sk?.unlocks.map((u) => u.name).join(", ")}.`
                : "You need 4 of 5. Read the explanations below, then try a fresh set."}
            </p>
          </header>
          <Review graded={result.graded} qs={qs} />
          <div className="flex flex-wrap gap-3">
            {!result.passed && <Button onClick={() => void begin({ kind: "repair", skillId: result.skillId })} disabled={busy}><RotateCcw className="size-4" /> Try a fresh set</Button>}
            <Button variant={result.passed ? "default" : "outline"} onClick={() => setMode(null)}>Back to your foundations</Button>
          </div>
        </div>
      );
    }
    const shaky = result.skills.filter((s) => s.status === "shaky");
    const score = result.graded.filter((g) => g.correct).length;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="paper-card p-6 text-center sm:p-8">
          <p className="font-hand text-2xl text-redpen">foundation check</p>
          <p className="mt-1 font-mono text-5xl text-ink">{score}/{result.graded.length}</p>
          <p className="mt-2 text-ink-soft">in {mmss(elapsed)} · {shaky.length ? `${shaky.length} skill${shaky.length > 1 ? "s" : ""} to repair` : "every foundation is solid"}</p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.skills.map((r) => {
            const sk = overview.skills.find((s) => s.id === r.skillId);
            return (
              <li key={r.skillId} className="paper-card flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{skillName(r.skillId)}</p>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", STATE_CHIP[r.status].cls)}>{STATE_CHIP[r.status].label}</span>
                </div>
                <p className="font-mono text-xs text-ink-soft">{r.correct}/{r.total} right</p>
                {r.status === "shaky" && (
                  <>
                    <p className="text-sm text-ink-soft">Fixing this unlocks: {sk?.unlocks.map((u) => u.name).join(", ")}</p>
                    <Button size="sm" className="mt-auto self-start" onClick={() => void begin({ kind: "repair", skillId: r.skillId })} disabled={busy}>
                      <Wrench className="size-4" /> Repair (5 questions)
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <Review graded={result.graded} qs={qs} />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setMode(null)}>See all foundations</Button>
          <Link href="/diagnostic" className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
            On to the CAT diagnostic <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  /* ── a question ── */
  if (mode) {
    const q = qs[i];
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">
            {mode.kind === "check" ? "Foundation check" : `Repair · ${skillName(mode.skillId)}`} · {i + 1} of {qs.length}
          </p>
          <p className="font-mono text-sm text-ink-soft" aria-label="Time so far">{mmss(elapsed)}</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div className="h-full bg-ink transition-[width]" style={{ width: `${(i / qs.length) * 100}%` }} />
        </div>
        <section className="paper-card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{skillName(q.skillId)}</p>
          <MathText text={q.stem} className="mt-2 block text-xl leading-relaxed text-ink" />
          <div className="mt-5 grid gap-2">
            {q.options.map((o, k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => void choose(k)}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-ink/40 disabled:opacity-60"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm">{LETTERS[k]}</span>
                <MathText text={o} className="text-[0.98rem] text-ink" />
              </button>
            ))}
          </div>
        </section>
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>No time limit. Press A–D to answer.</span>
          {i > 0 && !busy && (
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setI(i - 1)}>Back</button>
          )}
        </div>
        {busy && <PenLoader label="Marking…" className="mx-auto" />}
        {error && <p className="margin-note">{error}</p>}
      </div>
    );
  }

  /* ── overview ── */
  const shaky = overview.skills.filter((s) => s.state === "shaky");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="font-hand text-2xl text-redpen">before the CAT stuff</p>
        <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Foundations</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Most CAT topics stand on a few pieces of school maths. If one of those is shaky, the CAT topics on top of it stay stuck however much you
          practise them. A 12-question check (about 10 minutes, no time limit) finds the weak ones; a 5-question repair fixes each.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => void begin({ kind: "check" })} disabled={busy}>
            {overview.checked ? <><RotateCcw className="size-4" /> Retake the check</> : <>Start the foundation check <ArrowRight className="size-4" /></>}
          </Button>
          {overview.checked && <span className="text-sm text-ink-soft">{shaky.length ? `${shaky.length} to repair` : "All solid or repaired"}</span>}
        </div>
        {error && <p className="margin-note mt-3">{error}</p>}
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {overview.skills.map((sk) => (
          <li key={sk.id} className={cn("paper-card flex flex-col gap-2 p-4", sk.state === "shaky" && "border-l-4 border-l-redpen")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{sk.name}</p>
                <p className="text-sm text-ink-soft">{sk.description}</p>
              </div>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", STATE_CHIP[sk.state].cls)}>{STATE_CHIP[sk.state].label}</span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              {sk.state === "shaky" ? <Lock className="size-3.5" aria-hidden="true" /> : <Unlock className="size-3.5" aria-hidden="true" />}
              {sk.state === "shaky" ? "Fixing this unlocks:" : "Supports:"}
              {sk.unlocks.map((u) => (
                <Link key={u.id} href={`/learn/${u.id}`} className="rounded-full border px-2 py-0.5 hover:bg-accent">
                  {u.name}
                  {u.p != null && <span className="ml-1 font-mono">{Math.round(u.p * 100)}%</span>}
                </Link>
              ))}
            </p>
            {sk.state === "shaky" && sk.stuck.length > 0 && (
              <p className="text-sm text-redpen">This may be why {sk.stuck.join(" and ")} {sk.stuck.length > 1 ? "are" : "is"} stuck below 40%.</p>
            )}
            {sk.state === "shaky" && (
              <Button size="sm" className="mt-auto self-start" onClick={() => void begin({ kind: "repair", skillId: sk.id })} disabled={busy}>
                <Wrench className="size-4" /> Repair (5 questions, pass 4)
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Review({ graded, qs }: { graded: Graded[]; qs: Q[] }) {
  const byId = new Map(qs.map((q) => [q.id, q]));
  const wrong = graded.filter((g) => !g.correct);
  if (!wrong.length) return null;
  return (
    <section aria-labelledby="review-h" className="space-y-3">
      <h2 id="review-h" className="text-2xl">What went wrong</h2>
      <ul className="space-y-3">
        {wrong.map((g) => {
          const q = byId.get(g.id);
          if (!q) return null;
          return (
            <li key={g.id} className="paper-card p-4">
              <MathText text={q.stem} className="block text-ink" />
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {g.choice != null && (
                  <span className="inline-flex items-center gap-1 text-redpen"><X className="size-3.5" aria-hidden="true" /> You: <MathText text={q.options[g.choice]} /></span>
                )}
                <span className="inline-flex items-center gap-1 text-mastery-high"><Check className="size-3.5" aria-hidden="true" /> Answer: <MathText text={q.options[g.answerIndex]} /></span>
              </p>
              <MathText text={g.explanation} className="margin-note mt-2 block" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
