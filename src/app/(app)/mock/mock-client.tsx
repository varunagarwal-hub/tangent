"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, ClipboardCheck, Eraser, Search, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";
import { PenLoader } from "@/components/tangent/pen-loader";
import { RedPenWork } from "@/components/tangent/red-pen-work";
import { readNdjson } from "@/lib/client/answer-flow";
import type { DetectiveEvent, Diagnosis, PublicQuestion, WorkLine } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type Saved = Record<string, { answer: string | null; marked: boolean; timeSec: number }>;
interface Active { id: string; questions: PublicQuestion[]; answers: Saved; endsAt: string }
interface Item {
  questionId: string; conceptId: string; conceptName: string; area: string; type: "MCQ" | "TITA"; stem: string; options: string[] | null;
  answer: string | null; correctAnswer: string; solution: string; correct: boolean; marks: number; timeSec: number; targetTimeSec: number; attemptId: string | null;
}
interface Results { score: number; max: number; correct: number; wrong: number; skipped: number; negative: number; items: Item[]; debrief: { lines: string[] } }
interface State { active: Active | null; history: { id: string; score: number; submittedAt: string }[]; last: { id: string; results: Results } | null }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LETTERS = ["A", "B", "C", "D"];

export function MockClient() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"intro" | "exam" | "results">("intro");
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/mock");
      if (!r.ok) throw new Error(String(r.status));
      const d: State = await r.json();
      setState(d);
      if (d.active) setView("exam"); // resumable after a reload
    } catch {
      setError("Couldn't load the mock. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/mock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      if (!r.ok) throw new Error(String(r.status));
      setState(await r.json());
      setView("exam");
      window.scrollTo({ top: 0 });
    } catch {
      setError("Couldn't start a mock. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !state) return <p className="margin-note mx-auto max-w-xl">{error}</p>;
  if (!state) return <PenLoader label="Printing the paper…" className="mx-auto mt-16" />;

  if (view === "exam" && state.active)
    return (
      <Exam
        active={state.active}
        onDone={(r) => {
          setResults(r);
          setView("results");
          setState((s) => (s ? { ...s, active: null, last: { id: s.active?.id ?? "", results: r } } : s));
          window.scrollTo({ top: 0 });
        }}
      />
    );
  if (view === "results" && (results ?? state.last?.results)) return <ResultsView r={(results ?? state.last!.results)!} onBack={() => { setView("intro"); void load(); }} />;

  /* ── intro ── */
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="font-hand text-2xl text-redpen">the real thing, minus the nerves</p>
        <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">CAT sectional mock</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">The QA section as CAT sets it: 22 questions from every area, about a third of them type-in answers, one 40-minute clock.</p>
      </header>
      <ul className="paper-card grid gap-3 p-5 text-[0.95rem] sm:grid-cols-2">
        <li><b className="font-semibold">+3</b> for a right answer, <b className="font-semibold">−1</b> for a wrong MCQ.</li>
        <li>A wrong type-in (TITA) answer costs <b className="font-semibold">nothing</b>.</li>
        <li>Skip freely and <b className="font-semibold">mark for review</b> to come back.</li>
        <li>No feedback until you submit. Then a full review and a Skip Coach debrief.</li>
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={() => void start()} disabled={busy}>
          <Timer className="size-4" /> Start the 40-minute mock
        </Button>
        {state.last && (
          <Button variant="outline" onClick={() => { setResults(state.last!.results); setView("results"); }}>
            Last result: {state.last.results.score}/{state.last.results.max}
          </Button>
        )}
      </div>
      {state.history.length > 1 && (
        <p className="font-mono text-sm text-ink-soft">Past scores: {state.history.map((h) => h.score).reverse().join(" → ")}</p>
      )}
      {error && <p className="margin-note">{error}</p>}
    </div>
  );
}

/* ───────────────────────── exam ───────────────────────── */

function Exam({ active, onDone }: { active: Active; onDone: (r: Results) => void }) {
  const qs = active.questions;
  const [i, setI] = useState(() => Math.max(0, qs.findIndex((q) => !active.answers[q.id]?.answer)));
  const [answers, setAnswers] = useState<Saved>(() => Object.fromEntries(qs.map((q) => [q.id, active.answers[q.id] ?? { answer: null, marked: false, timeSec: 0 }])));
  const [left, setLeft] = useState(() => Math.max(0, (Date.parse(active.endsAt) - Date.now()) / 1000));
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const iRef = useRef(i);
  iRef.current = i;
  const lastTick = useRef(0);
  const dirty = useRef(false);
  const submitted = useRef(false);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const r = await fetch("/api/mock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", id: active.id, answers: answersRef.current }) });
      const d = await r.json();
      if (!r.ok || !d.results) throw new Error(String(r.status));
      onDone(d.results);
    } catch {
      submitted.current = false;
      setSubmitting(false);
      alert("Couldn't submit. Check your connection and press Submit again; your answers are kept.");
    }
  }, [active.id, onDone]);

  // one clock: counts down, charges elapsed time to the question on screen, autosaves, submits at zero
  useEffect(() => {
    lastTick.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const remaining = Math.max(0, (Date.parse(active.endsAt) - now) / 1000);
      setLeft(remaining);
      const qid = qs[iRef.current]?.id;
      if (qid) setAnswers((a) => ({ ...a, [qid]: { ...a[qid], timeSec: a[qid].timeSec + dt } }));
      if (remaining <= 0) {
        clearInterval(t);
        void submit();
      }
    }, 1000);
    const save = setInterval(() => {
      if (!dirty.current || submitted.current) return;
      dirty.current = false;
      void fetch("/api/mock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", id: active.id, answers: answersRef.current }) }).catch(() => (dirty.current = true));
    }, 10_000);
    return () => {
      clearInterval(t);
      clearInterval(save);
    };
  }, [active.endsAt, active.id, qs, submit]);

  const q = qs[i];
  const cur = answers[q.id];
  const set = (patch: Partial<Saved[string]>) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [q.id]: { ...a[q.id], ...patch } }));
  };
  const go = (k: number) => {
    setI(Math.max(0, Math.min(qs.length - 1, k)));
    setPaletteOpen(false);
    window.scrollTo({ top: 0 });
  };
  const counts = useMemo(() => {
    const vals = qs.map((x) => answers[x.id]);
    return { answered: vals.filter((v) => v.answer).length, marked: vals.filter((v) => v.marked).length };
  }, [answers, qs]);
  const urgent = left < 300;

  if (submitting) return <PenLoader label="Marking your paper…" className="mx-auto mt-16" />;

  const palette = (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-4" role="list" aria-label="Question palette">
      {qs.map((x, k) => {
        const a = answers[x.id];
        return (
          <button
            key={x.id}
            type="button"
            role="listitem"
            onClick={() => go(k)}
            aria-label={`Question ${k + 1}${a.answer ? ", answered" : ""}${a.marked ? ", marked for review" : ""}`}
            aria-current={k === i ? "step" : undefined}
            className={cn(
              "relative h-9 rounded-md border font-mono text-sm",
              a.answer ? "border-ink bg-ink text-paper" : "border-border bg-card text-ink",
              k === i && "ring-2 ring-redpen ring-offset-1 ring-offset-background",
            )}
          >
            {k + 1}
            {a.marked && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-redpen" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">QA mock</span> · {counts.answered}/{qs.length} answered{counts.marked ? ` · ${counts.marked} marked` : ""}
        </p>
        <div className="flex items-center gap-3">
          <p className={cn("font-mono text-2xl tabular-nums", urgent ? "text-redpen" : "text-ink")} role="timer" aria-label={`${Math.ceil(left / 60)} minutes left`}>
            {fmt(left)}
          </p>
          <Button size="sm" onClick={() => setConfirming(true)}>
            <ClipboardCheck className="size-4" /> Submit
          </Button>
        </div>
      </div>

      {confirming && (
        <div className="paper-card mb-4 border-l-4 border-l-redpen p-4" role="alertdialog" aria-labelledby="confirm-h">
          <p id="confirm-h" className="font-semibold text-ink">Submit the mock?</p>
          <p className="mt-1 text-sm text-ink-soft">
            {counts.answered} answered · {qs.length - counts.answered} unanswered{counts.marked ? ` · ${counts.marked} still marked for review` : ""}. You have {fmt(left)} left.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void submit()}>Yes, submit</Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>Keep going</Button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <section className="paper-card p-5 sm:p-6" aria-labelledby="q-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="q-h" className="text-2xl">Question {i + 1}</h2>
            <p className="text-xs text-ink-soft">{q.type === "MCQ" ? "MCQ · +3 / −1" : "Type in the answer · +3 / 0"}</p>
          </div>
          <MathText text={q.stem} className="mt-3 block text-lg leading-relaxed text-ink" />

          {q.type === "MCQ" && q.options ? (
            <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Options">
              {q.options.map((o, k) => {
                const on = cur.answer === o;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ answer: on ? null : o })}
                    className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors", on ? "border-ink bg-ink/5" : "hover:border-ink/40")}
                  >
                    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm", on && "border-ink bg-ink text-paper")}>{LETTERS[k]}</span>
                    <MathText text={o} className="text-[0.98rem] text-ink" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 max-w-xs">
              <label htmlFor="tita" className="text-sm text-ink-soft">Your answer (a number)</label>
              <input
                id="tita"
                value={cur.answer ?? ""}
                onChange={(e) => set({ answer: e.target.value.replace(/[^0-9.\-−/]/g, "") || null })}
                inputMode="decimal"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border-2 border-ink/20 bg-background px-4 py-2.5 font-mono text-xl text-ink outline-none focus:border-ink"
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => go(i - 1)} disabled={i === 0}>
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => set({ answer: null })} disabled={!cur.answer}>
              <Eraser className="size-4" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => { set({ marked: !cur.marked }); if (!cur.marked) go(i + 1); }}>
              <Bookmark className={cn("size-4", cur.marked && "fill-redpen text-redpen")} /> {cur.marked ? "Unmark" : "Mark & next"}
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => (i + 1 < qs.length ? go(i + 1) : setConfirming(true))}>
              {i + 1 < qs.length ? <>Next <ArrowRight className="size-4" /></> : <>Finish <ClipboardCheck className="size-4" /></>}
            </Button>
          </div>
        </section>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <button type="button" className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-ink lg:pointer-events-none" onClick={() => setPaletteOpen((o) => !o)} aria-expanded={paletteOpen}>
            All questions <ChevronDown className={cn("size-4 transition-transform lg:hidden", paletteOpen && "rotate-180")} aria-hidden="true" />
          </button>
          <div className={cn(paletteOpen ? "block" : "hidden", "lg:block")}>
            {palette}
            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-ink" /> answered</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-sm border border-border" /> not answered</li>
              <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-redpen" /> marked for review</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ───────────────────────── results ───────────────────────── */

function ResultsView({ r, onBack }: { r: Results; onBack: () => void }) {
  const attempted = r.correct + r.wrong;
  const acc = attempted ? r.correct / attempted : 0;
  const maxTime = Math.max(60, ...r.items.map((x) => x.timeSec));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="paper-card p-6 text-center sm:p-8">
        <p className="font-hand text-2xl text-redpen">pens down</p>
        <p className="mt-1 font-mono text-6xl tabular-nums text-ink">
          {r.score}
          <span className="text-2xl text-ink-soft">/{r.max}</span>
        </p>
        <p className="mt-2 text-ink-soft">
          {r.correct} right (+{r.correct * 3}) · {r.wrong} wrong{r.negative ? ` (−${r.negative})` : ""} · {r.skipped} skipped
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Attempted</dt><dd className="font-mono text-2xl text-ink">{attempted}/{r.items.length}</dd></div>
        <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Accuracy</dt><dd className="font-mono text-2xl text-ink">{Math.round(acc * 100)}%</dd></div>
        <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Per attempt</dt><dd className="font-mono text-2xl text-ink">{attempted ? fmt(r.items.filter((x) => x.answer).reduce((t, x) => t + x.timeSec, 0) / attempted) : "–"}</dd></div>
      </dl>

      {r.debrief.lines.length > 0 && (
        <section className="paper-card border-l-4 border-l-redpen p-5" aria-labelledby="coach-h">
          <h2 id="coach-h" className="text-2xl">Skip Coach debrief</h2>
          <ul className="mt-2 space-y-1.5 text-ink">
            {r.debrief.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <Link href="/strategy" className="mt-3 inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:underline">
            Your full strategy page <ArrowRight className="size-3.5" />
          </Link>
        </section>
      )}

      <section aria-labelledby="time-h">
        <h2 id="time-h" className="mb-2 text-2xl">Time per question</h2>
        <ol className="paper-card space-y-1.5 p-4">
          {r.items.map((x, k) => (
            <li key={x.questionId} className="grid grid-cols-[1.75rem_1fr_3rem] items-center gap-2 text-xs">
              <span className="font-mono text-ink-soft">{k + 1}</span>
              <span className="relative h-3 rounded-sm bg-border/60">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-sm", !x.answer ? "bg-mastery-unknown" : x.correct ? "bg-mastery-high" : "bg-redpen")}
                  style={{ width: `${Math.max(2, (x.timeSec / maxTime) * 100)}%` }}
                />
                <span className="absolute inset-y-[-2px] w-px bg-ink/50" style={{ left: `${Math.min(100, (x.targetTimeSec / maxTime) * 100)}%` }} title="target time" />
              </span>
              <span className="text-right font-mono text-ink-soft">{fmt(x.timeSec)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-ink-soft">Green right, red wrong, grey skipped. The thin line is the target time for that topic.</p>
      </section>

      <section aria-labelledby="review-h" className="space-y-3">
        <h2 id="review-h" className="text-2xl">Review</h2>
        {r.items.map((x, k) => <ReviewItem key={x.questionId} x={x} n={k + 1} />)}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onBack}>Back to mocks</Button>
        <Link href="/practice" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Practise <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function ReviewItem({ x, n }: { x: Item; n: number }) {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState("");
  const [running, setRunning] = useState(false);
  const [diag, setDiag] = useState<{ lines: WorkLine[]; d: Diagnosis } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const detect = async () => {
    if (!x.attemptId || !work.trim()) return;
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch("/api/detective", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: x.attemptId, work: { text: work, source: "type" }, quick: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await readNdjson(res, (e: DetectiveEvent) => {
        if (e.type === "diagnosis") setDiag({ lines: e.lines, d: e.diagnosis });
        else if (e.type === "error") setErr(e.message);
      });
    } catch {
      setErr("The detective couldn't run this time.");
    } finally {
      setRunning(false);
    }
  };

  const status = !x.answer ? "skipped" : x.correct ? "right" : "wrong";
  return (
    <article className={cn("paper-card p-4", status === "wrong" && "border-l-4 border-l-redpen")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Q{n} · {x.conceptName} · {x.type} · {fmt(x.timeSec)}
          </span>
          <MathText text={x.stem} className={cn("mt-1 block text-ink", !open && "line-clamp-2")} />
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs",
            status === "right" ? "border-mastery-high/50 text-mastery-high" : status === "wrong" ? "border-redpen/50 text-redpen" : "border-border text-ink-soft",
          )}
        >
          {status === "right" ? <Check className="size-3" aria-hidden="true" /> : status === "wrong" ? <X className="size-3" aria-hidden="true" /> : null}
          {x.marks > 0 ? `+${x.marks}` : x.marks}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-dashed border-border pt-3">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>You: {x.answer ? <MathText text={x.answer} /> : <span className="text-ink-soft">skipped</span>}</span>
            <span className="text-mastery-high">Answer: <MathText text={x.correctAnswer} /></span>
          </p>
          <MathText text={x.solution} className="block text-sm leading-relaxed text-ink" />
          {status === "wrong" && x.attemptId && !diag && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <label htmlFor={`w-${x.questionId}`} className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Search className="size-4 text-redpen" aria-hidden="true" /> Find where your working went off on a tangent
              </label>
              <textarea
                id={`w-${x.questionId}`}
                value={work}
                onChange={(e) => setWork(e.target.value)}
                rows={4}
                placeholder="Type your rough work, one step per line"
                className="mt-2 w-full rounded-lg border border-border bg-background p-2 font-hand text-xl text-ink"
              />
              <Button size="sm" className="mt-2" onClick={() => void detect()} disabled={running || !work.trim()}>
                {running ? "Reading your work…" : "Run the Detective"}
              </Button>
              {err && <p className="mt-2 text-sm text-redpen">{err}</p>}
            </div>
          )}
          {diag && (
            <div className="space-y-2">
              <RedPenWork lines={diag.lines} errorLine={diag.d.errorLineNumber} note={diag.d.explanation} verdict={diag.d.reasoningVerdict} />
              {diag.d.misconceptionName && <p className="text-sm text-redpen">Off on a tangent: {diag.d.misconceptionName}</p>}
            </div>
          )}
          <Link href={`/learn/${x.conceptId}`} className="inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:underline">
            Revise {x.conceptName} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}
