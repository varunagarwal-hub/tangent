"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Delete, RotateCcw, SkipForward, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PenLoader } from "@/components/tangent/pen-loader";
import { cn } from "@/lib/utils";
import { CATEGORIES, KIND_LABEL, SPRINT_SECONDS, checkAnswer, makeRound, type SprintCategory, type SprintItem, type SprintKind } from "@/lib/sprint";

interface Answer { item: SprintItem; typed: string; correct: boolean; ms: number }
interface Saved { score: number; best: number; isBest: boolean }
type Phase = "intro" | "play" | "done";

/** Which concept card helps with each drill. */
const KIND_CONCEPT: Record<SprintKind, string> = {
  frac_pct: "A1", pct_frac: "A1", pct_change: "A1", discount: "A4", square: "L1", cube: "L1", multiply: "N1", ratio: "A2", remainder: "N3",
};

export function SprintClient() {
  const [bests, setBests] = useState<Record<SprintCategory, number | null> | null>(null);
  const [category, setCategory] = useState<SprintCategory>("all");
  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<SprintItem[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [left, setLeft] = useState(SPRINT_SECONDS);
  const [flash, setFlash] = useState<{ kind: "right" | "wrong"; text: string } | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [touch, setTouch] = useState(false);
  const endAt = useRef(0);
  const itemStart = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const answersRef = useRef<Answer[]>([]);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    fetch("/api/play/sprint")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBests(d?.bests ?? { all: null, percent: null, squares: null, fractions: null }))
      .catch(() => setBests({ all: null, percent: null, squares: null, fractions: null }));
  }, []);

  const save = useCallback(async (list: Answer[], cat: SprintCategory) => {
    setSaveError(false);
    try {
      const r = await fetch("/api/play/sprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: cat, answers: list.map((a) => ({ kind: a.item.kind, correct: a.correct, ms: Math.round(a.ms) })) }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d: Saved = await r.json();
      setSaved(d);
      setBests((b) => (b ? { ...b, [cat]: d.best } : b));
    } catch {
      setSaveError(true);
    }
  }, []);

  const finish = useCallback(() => {
    setPhase("done");
    void save(answersRef.current, category);
  }, [save, category]);

  // countdown
  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const s = Math.max(0, (endAt.current - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        finish();
      }
    }, 100);
    return () => clearInterval(t);
  }, [phase, finish]);

  const start = () => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    setItems(makeRound(seed, category, 120));
    setI(0);
    setTyped("");
    setAnswers([]);
    answersRef.current = [];
    setSaved(null);
    setFlash(null);
    setLeft(SPRINT_SECONDS);
    endAt.current = Date.now() + SPRINT_SECONDS * 1000;
    itemStart.current = Date.now();
    setPhase("play");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const record = (correct: boolean, value: string) => {
    const item = items[i];
    if (!item) return;
    const a: Answer = { item, typed: value, correct, ms: Date.now() - itemStart.current };
    answersRef.current = [...answersRef.current, a];
    setAnswers(answersRef.current);
    setFlash(correct ? { kind: "right", text: "✓" } : { kind: "wrong", text: `${item.display}` });
    setTimeout(() => setFlash(null), correct ? 250 : 900);
    setTyped("");
    itemStart.current = Date.now();
    if (i + 1 >= items.length) finish();
    else setI(i + 1);
  };

  const onType = (v: string) => {
    if (phase !== "play") return;
    const clean = v.replace(/[^0-9.\-−]/g, "");
    setTyped(clean);
    if (items[i] && checkAnswer(items[i], clean)) record(true, clean);
  };
  const submit = () => {
    if (phase !== "play" || !typed) return;
    record(checkAnswer(items[i], typed), typed);
  };
  const key = (k: string) => {
    if (k === "⌫") setTyped((t) => t.slice(0, -1));
    else if (k === "−") onType(typed.startsWith("-") ? typed.slice(1) : `-${typed}`);
    else onType(typed + k);
  };

  if (!bests) return <PenLoader label="Sharpening pencils…" className="mx-auto mt-16" />;

  /* ── intro ── */
  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="font-hand text-2xl text-redpen">60 seconds, no calculator</p>
          <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">CAT speed sprint</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            In CAT, knowing 1/7 = 14.28% or 24² = 576 without working it out buys you minutes for the hard questions. Answer as many as you can in
            a minute. A correct answer moves on by itself; press Enter to give up on one.
          </p>
        </header>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">What to drill</legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <label
                key={c.id}
                className={cn(
                  "cursor-pointer rounded-xl border bg-card px-4 py-3 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  category === c.id ? "border-ink" : "border-border hover:border-ink/40",
                )}
              >
                <input type="radio" name="cat" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="sr-only" />
                <span className="block font-semibold text-ink">{c.label}</span>
                <span className="font-mono text-xs text-ink-soft">best {bests[c.id] ?? "–"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button size="lg" onClick={start}>
          <Timer className="size-4" /> Start the sprint
        </Button>
      </div>
    );
  }

  /* ── results ── */
  if (phase === "done") {
    const correct = answers.filter((a) => a.correct).length;
    const acc = answers.length ? correct / answers.length : 0;
    const avg = answers.length ? answers.reduce((t, a) => t + a.ms, 0) / answers.length / 1000 : 0;
    const byKind = new Map<SprintKind, { n: number; correct: number; ms: number }>();
    for (const a of answers) {
      const k = byKind.get(a.item.kind) ?? { n: 0, correct: 0, ms: 0 };
      k.n++;
      if (a.correct) k.correct++;
      k.ms += a.ms;
      byKind.set(a.item.kind, k);
    }
    const kinds = [...byKind.entries()].map(([kind, v]) => ({ kind, ...v, avg: v.ms / v.n / 1000 })).sort((a, b) => b.avg - a.avg);
    const slowest = kinds.length > 1 ? kinds[0] : null;
    const misses = answers.filter((a) => !a.correct).slice(0, 6);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="paper-card p-6 text-center sm:p-8">
          <p className="font-hand text-2xl text-redpen">time!</p>
          <p className="mt-1 font-mono text-6xl tabular-nums text-ink">{correct}</p>
          <p className="text-ink-soft">correct in {SPRINT_SECONDS} seconds · {CATEGORIES.find((c) => c.id === category)?.label}</p>
          {saved && <p className="mt-2">{saved.isBest ? <span className="font-semibold text-redpen">New personal best!</span> : <span className="text-ink-soft">Personal best: <span className="font-mono">{saved.best}</span></span>}</p>}
          {saveError && (
            <p className="mt-2 text-sm text-redpen">
              Couldn’t save your score. <button type="button" className="underline" onClick={() => void save(answers, category)}>Try again</button>
            </p>
          )}
        </header>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Accuracy</dt><dd className="font-mono text-2xl text-ink">{Math.round(acc * 100)}%</dd></div>
          <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Per answer</dt><dd className="font-mono text-2xl text-ink">{avg.toFixed(1)}s</dd></div>
          <div className="paper-card p-3"><dt className="text-xs text-ink-soft">Attempted</dt><dd className="font-mono text-2xl text-ink">{answers.length}</dd></div>
        </dl>
        {slowest && (
          <p className="margin-note">
            Slowest: <b className="font-semibold">{KIND_LABEL[slowest.kind]}</b> at {slowest.avg.toFixed(1)}s each.{" "}
            <Link href={`/learn/${KIND_CONCEPT[slowest.kind]}`} className="underline underline-offset-2">Revise the shortcuts</Link>, then try a{" "}
            {slowest.kind === "square" || slowest.kind === "cube" ? "Squares & cubes" : slowest.kind === "pct_change" || slowest.kind === "discount" ? "Percentages" : "Fractions"} sprint.
          </p>
        )}
        {kinds.length > 0 && (
          <table className="paper-card w-full text-sm">
            <thead>
              <tr className="border-b border-dashed border-border text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2 font-semibold">Drill</th><th className="px-2 py-2 text-right font-semibold">Right</th><th className="px-4 py-2 text-right font-semibold">Avg</th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k.kind} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 text-ink">{KIND_LABEL[k.kind]}</td>
                  <td className="px-2 py-2 text-right font-mono">{k.correct}/{k.n}</td>
                  <td className="px-4 py-2 text-right font-mono">{k.avg.toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {misses.length > 0 && (
          <section aria-labelledby="misses">
            <h2 id="misses" className="mb-2 text-2xl">Worth memorising</h2>
            <ul className="paper-card divide-y divide-dashed divide-border">
              {misses.map((m) => (
                <li key={m.item.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-ink">{m.item.prompt}</span>
                  <span className="shrink-0 font-mono text-ink">{m.item.display} {m.typed && <span className="text-redpen line-through">{m.typed}</span>}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={start}><RotateCcw className="size-4" /> Go again</Button>
          <Button variant="outline" onClick={() => setPhase("intro")}>Change drill</Button>
          <Link href="/play" className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink">
            More games <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  /* ── playing ── */
  const item = items[i];
  const correct = answers.filter((a) => a.correct).length;
  const urgent = left <= 10;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-ink-soft" aria-live="off">
          {correct} right · {answers.length - correct} missed
        </p>
        <p className={cn("font-mono text-3xl tabular-nums", urgent ? "text-redpen" : "text-ink")} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
          0:{String(Math.ceil(left)).padStart(2, "0")}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className={cn("h-full transition-[width] duration-100 ease-linear", urgent ? "bg-redpen" : "bg-ink")} style={{ width: `${(left / SPRINT_SECONDS) * 100}%` }} />
      </div>

      <section className="paper-card relative px-5 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{item ? KIND_LABEL[item.kind] : ""}</p>
        <p className="mt-3 text-3xl leading-snug text-ink sm:text-4xl" aria-live="polite">{item?.prompt}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mx-auto mt-6 max-w-56"
        >
          <label htmlFor="sprint-answer" className="sr-only">Your answer</label>
          <input
            id="sprint-answer"
            ref={inputRef}
            value={typed}
            onChange={(e) => onType(e.target.value)}
            inputMode={touch ? "none" : "decimal"}
            readOnly={touch}
            autoComplete="off"
            className="w-full rounded-xl border-2 border-ink/20 bg-background px-4 py-3 text-center font-mono text-3xl tabular-nums text-ink outline-none focus:border-ink"
          />
        </form>
        {flash && (
          <p className={cn("absolute inset-x-0 bottom-2 text-sm font-medium", flash.kind === "right" ? "text-mastery-high" : "text-redpen")}>
            {flash.kind === "right" ? "✓" : `It was ${flash.text}`}
          </p>
        )}
      </section>

      {touch ? (
        <div className="grid grid-cols-4 gap-2" aria-label="Keypad">
          {["7", "8", "9", "⌫", "4", "5", "6", "−", "1", "2", "3", ".", "0"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => key(k)}
              className={cn("h-14 rounded-xl border border-border bg-card font-mono text-2xl text-ink active:bg-accent", k === "0" && "col-span-2")}
              aria-label={k === "⌫" ? "Delete" : k === "−" ? "Minus" : k}
            >
              {k === "⌫" ? <Delete className="mx-auto size-6" aria-hidden="true" /> : k}
            </button>
          ))}
          <button type="button" onClick={submit} className="col-span-2 h-14 rounded-xl bg-ink font-medium text-paper">
            Skip / Enter
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>A right answer moves on by itself. Enter skips.</span>
          <Button variant="ghost" size="sm" onClick={submit} disabled={!typed}>
            <SkipForward className="size-4" /> Skip
          </Button>
        </div>
      )}
    </div>
  );
}
