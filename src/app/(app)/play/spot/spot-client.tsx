"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { annotate } from "rough-notation";
import type { RoughAnnotation } from "rough-notation/lib/model";
import { ArrowRight, BookOpen, Check, RotateCcw, Search, Target, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";
import { PenLoader } from "@/components/tangent/pen-loader";
import { markDemoStep } from "@/components/tangent/demo-guide/events";
import { cn } from "@/lib/utils";

interface Round {
  id: string;
  question: string;
  conceptName: string;
  lines: { n: number; text: string }[];
  errorLine: number;
  misconceptionId: string;
  options: { id: string; name: string }[];
  explanation: { name: string; description: string; fix: string };
  yours: boolean;
}
interface RoundResult { roundId: string; lineTries: 0 | 1 | 2; named: boolean }
interface Saved { score: number; max: number; best: number; isBest: boolean; credited: string[] }

type Phase = "find" | "name" | "explain";
const LETTERS = ["A", "B", "C"];

/** Hand-drawn red circle (or box, for long lines) around the target line, redrawn on resize/theme change. */
function useRedCircle(target: HTMLElement | null, on: boolean) {
  useEffect(() => {
    if (!on || !target) return;
    let a: RoughAnnotation | null = null;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (animate: boolean) => {
      a?.remove();
      const long = target.getBoundingClientRect().width > 360;
      a = annotate(target, {
        type: long ? "box" : "circle",
        color: getComputedStyle(document.documentElement).getPropertyValue("--redpen").trim() || "#d93a2b",
        strokeWidth: 2,
        iterations: 2,
        padding: long ? [4, 8] : [6, 14],
        animate: animate && !reduced,
        animationDuration: 800,
      });
      a.show();
    };
    draw(true);
    const ro = new ResizeObserver(() => !cancelled && draw(false));
    ro.observe(target.parentElement ?? target);
    const mo = new MutationObserver(() => !cancelled && draw(false));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
      a?.remove();
    };
  }, [target, on]);
}

export function SpotClient() {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("find");
  const [wrongTaps, setWrongTaps] = useState<number[]>([]);
  const [found, setFound] = useState<0 | 1 | 2>(0); // 1 = first try, 2 = second try, 0 = missed
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lineEl, setLineEl] = useState<HTMLSpanElement | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setError(null);
    setRounds(null);
    try {
      const r = await fetch("/api/play/spot");
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setRounds(d.rounds);
      setBest(d.best);
    } catch {
      setError("Couldn't load a game. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const round = rounds?.[i];
  const done = finished;
  const score = results.reduce((t, r) => t + (r.lineTries === 1 ? 10 : r.lineTries === 2 ? 5 : 0) + (r.named ? 10 : 0), 0);

  useRedCircle(lineEl, phase !== "find");

  const restart = () => {
    setStarted(true);
    setI(0);
    setPhase("find");
    setWrongTaps([]);
    setFound(0);
    setPicked(null);
    setResults([]);
    setSaved(null);
    setFinished(false);
    setSaveError(false);
  };

  const tapLine = (n: number) => {
    if (!round || phase !== "find" || wrongTaps.includes(n)) return;
    if (n === round.errorLine) {
      setFound(wrongTaps.length === 0 ? 1 : 2);
      setPhase("name");
      return;
    }
    setShake(n);
    setTimeout(() => setShake(null), 400);
    const taps = [...wrongTaps, n];
    setWrongTaps(taps);
    if (taps.length >= 2) {
      setFound(0);
      setPhase("name");
    }
  };

  const pick = (id: string) => {
    if (!round || phase !== "name") return;
    setPicked(id);
    setPhase("explain");
    setResults((r) => [...r, { roundId: round.id, lineTries: found, named: id === round.misconceptionId }]);
    setTimeout(() => nextRef.current?.focus(), 50);
  };

  const next = async () => {
    if (!rounds) return;
    if (i + 1 < rounds.length) {
      setI(i + 1);
      setPhase("find");
      setWrongTaps([]);
      setFound(0);
      setPicked(null);
      setLineEl(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFinished(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await save();
  };

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const r = await fetch("/api/play/spot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ results }) });
      if (!r.ok) throw new Error(String(r.status));
      const d: Saved = await r.json();
      setSaved(d);
      setBest(d.best);
      markDemoStep("spot");
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // keyboard: 1–9 tap a line, A/B/C name it, Enter for next
  useEffect(() => {
    if (!started || !round || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (phase === "find" && /^[1-9]$/.test(e.key)) tapLine(Number(e.key));
      else if (phase === "name") {
        const k = LETTERS.indexOf(e.key.toUpperCase());
        if (k >= 0 && round.options[k]) pick(round.options[k].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <p className="margin-note text-left">{error}</p>
        <Button className="mt-4" onClick={() => void load()}>
          <RotateCcw className="size-4" /> Try again
        </Button>
      </div>
    );
  }
  if (!rounds) return <PenLoader label="Shuffling the notebooks…" className="mx-auto mt-16" />;

  /* ── intro ── */
  if (!started) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="font-hand text-2xl text-redpen">a game for sharp eyes</p>
          <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Spot the Tangent</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            You get someone else’s rough work. One line went off on a tangent. Find it, then name the mistake. Spotting slips in other people’s
            working is the fastest way to stop making them yourself.
          </p>
        </header>
        <ol className="paper-card grid gap-3 p-5 text-[0.95rem] sm:grid-cols-3">
          <li className="flex gap-3"><Search className="mt-0.5 size-5 shrink-0 text-redpen" aria-hidden="true" /><span><b className="font-semibold">Tap the wrong line.</b> +10 on the first try, +5 on the second.</span></li>
          <li className="flex gap-3"><Target className="mt-0.5 size-5 shrink-0 text-redpen" aria-hidden="true" /><span><b className="font-semibold">Name the mistake.</b> +10 if you pick the right one of three.</span></li>
          <li className="flex gap-3"><Trophy className="mt-0.5 size-5 shrink-0 text-redpen" aria-hidden="true" /><span><b className="font-semibold">10 rounds, 200 points.</b> Your own mistakes show up too.</span></li>
        </ol>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" onClick={restart}>
            Start the game <ArrowRight className="size-4" />
          </Button>
          {best != null && <span className="font-mono text-sm text-ink-soft">Your best: {best}/200</span>}
        </div>
        <p className="text-sm text-ink-soft">Keyboard: press 1–9 to tap a line, A/B/C to name the mistake, Enter for the next round.</p>
      </div>
    );
  }

  /* ── results ── */
  if (done) {
    const max = rounds.length * 20;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="paper-card p-6 text-center sm:p-8">
          <p className="font-hand text-2xl text-redpen">game over</p>
          <p className="mt-1 font-mono text-6xl text-ink tabular-nums">
            {saved?.score ?? score}
            <span className="text-2xl text-ink-soft">/{saved?.max ?? max}</span>
          </p>
          {saving && <PenLoader label="Saving your score…" className="mt-3" />}
          {saveError && (
            <p className="mt-3 text-sm text-redpen">
              Couldn’t save your score.{" "}
              <button type="button" className="underline" onClick={() => void save()}>Try again</button>
            </p>
          )}
          {saved && (
            <p className="mt-2 text-ink-soft">
              {saved.isBest ? (
                <span className="font-semibold text-redpen">New personal best!</span>
              ) : (
                <>Personal best: <span className="font-mono">{saved.best}</span></>
              )}
            </p>
          )}
        </header>
        {saved && saved.credited.length > 0 && (
          <p className="margin-note">
            You spotted and named your own tangent{saved.credited.length > 1 ? "s" : ""}: <b className="font-semibold">{saved.credited.join(", ")}</b>. That counts as a clean answer in your Mistake Journal.
          </p>
        )}
        <ul className="paper-card divide-y divide-dashed divide-border">
          {rounds.map((r, k) => {
            const res = results[k];
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Round {k + 1} · {r.conceptName}{r.yours ? " · yours" : ""}</p>
                  <p className="mt-0.5 font-medium text-ink">{r.explanation.name}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", res?.lineTries ? "border-mastery-high/50 text-mastery-high" : "border-redpen/40 text-redpen")}>
                    {res?.lineTries ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />} line
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", res?.named ? "border-mastery-high/50 text-mastery-high" : "border-redpen/40 text-redpen")}>
                    {res?.named ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />} name
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { void load().then(restart); }}>
            <RotateCcw className="size-4" /> Play again
          </Button>
          <Link href="/mistakes" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            <BookOpen className="size-4" /> Your Mistake Journal
          </Link>
          <Link href="/practice" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Practise <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  /* ── a round ── */
  if (!round) return null;
  const correctPick = picked === round.misconceptionId;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">
            Spot the Tangent · round {i + 1} of {rounds.length} · {round.conceptName}
          </p>
          <ol className="mt-2 flex gap-1.5" aria-label="Progress">
            {rounds.map((r, k) => (
              <li
                key={r.id}
                className={cn(
                  "size-2.5 rounded-full border",
                  k < results.length ? (results[k].lineTries && results[k].named ? "border-mastery-high bg-mastery-high" : "border-redpen bg-redpen") : k === i ? "border-ink bg-ink/30" : "border-ink/30",
                )}
              />
            ))}
          </ol>
        </div>
        <p className="font-mono text-2xl tabular-nums text-ink" aria-label={`Score ${score}`}>
          {score}
          <span className="text-sm text-ink-soft">/200</span>
        </p>
      </div>

      {round.yours && (
        <p className="inline-flex rounded-full border border-redpen/40 bg-redpen/8 px-3 py-1 text-sm font-medium text-redpen">This one is your own tangent: spot it in someone else’s work.</p>
      )}

      <section className="paper-card p-5">
        <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">The question</p>
        <MathText text={round.question} className="mt-1 block text-lg leading-relaxed text-ink" />
      </section>

      <section className="paper-card p-0" aria-labelledby="work-h">
        <p id="work-h" className="border-b border-dashed border-border px-5 py-3 text-sm font-medium text-ink">
          {phase === "find" ? (wrongTaps.length ? "Not that one: look again. Which line goes off on a tangent?" : "Their rough work. Tap the line where it goes off on a tangent.") : found ? `Found it${found === 2 ? " on the second try" : ""}: line ${round.errorLine}.` : `It was line ${round.errorLine}.`}
        </p>
        <ol className="divide-y divide-border/60">
          {round.lines.map((l) => {
            const wrong = wrongTaps.includes(l.n);
            const isErr = l.n === round.errorLine;
            return (
              <li key={l.n}>
                <button
                  type="button"
                  onClick={() => tapLine(l.n)}
                  disabled={phase !== "find" || wrong}
                  aria-label={`Line ${l.n}: ${l.text}`}
                  className={cn(
                    "grid w-full grid-cols-[2.5rem_1fr] items-center gap-2 px-3 py-3 text-left transition-colors",
                    phase === "find" && !wrong && "hover:bg-highlighter/30 focus-visible:bg-highlighter/30",
                    wrong && "opacity-50",
                    shake === l.n && "animate-[spot-shake_0.35s_ease-in-out]",
                  )}
                >
                  <span className="font-mono text-sm text-ink-soft">{l.n}</span>
                  <span className={cn("w-fit font-hand text-[1.55rem] leading-snug text-ink", wrong && "line-through decoration-redpen/60")}>
                    <span ref={isErr ? setLineEl : undefined} className="inline-block">
                      <MathText text={l.text} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {phase !== "find" && (
        <section aria-labelledby="name-h" className="space-y-3">
          <h2 id="name-h" className="text-2xl">{phase === "name" ? "Now name the mistake" : correctPick ? "Spot on." : "Not quite: here’s the mistake"}</h2>
          <div className="grid gap-2">
            {round.options.map((o, k) => {
              const isTrue = o.id === round.misconceptionId;
              const chosen = picked === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  disabled={phase !== "name"}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors",
                    phase === "name" && "hover:border-ink/40",
                    phase === "explain" && isTrue && "border-mastery-high bg-mastery-high/10",
                    phase === "explain" && chosen && !isTrue && "border-redpen bg-redpen/8",
                  )}
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm">{LETTERS[k]}</span>
                  <span className="text-[0.98rem] text-ink">{o.name}</span>
                  {phase === "explain" && isTrue && <Check className="ml-auto size-4 text-mastery-high" aria-label="Correct" />}
                  {phase === "explain" && chosen && !isTrue && <X className="ml-auto size-4 text-redpen" aria-label="Your pick" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {phase === "explain" && (
        <section className="paper-card space-y-2 p-5" aria-live="polite">
          <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-redpen">Off on a tangent · {round.explanation.name}</p>
          <MathText text={round.explanation.description} className="block leading-relaxed text-ink" />
          <p className="margin-note">
            <b className="font-semibold">How to fix it:</b> <MathText text={round.explanation.fix} />
          </p>
          <div className="flex justify-end pt-2">
            <Button ref={nextRef} size="lg" onClick={() => void next()} disabled={saving}>
              {i + 1 < rounds.length ? "Next round" : saving ? "Saving…" : "See your score"} <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
