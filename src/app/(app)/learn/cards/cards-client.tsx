"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";
import { PenLoader } from "@/components/tangent/pen-loader";
import { cn } from "@/lib/utils";

interface Card { id: string; conceptId: string; conceptName: string; kind: "formula" | "shortcut"; front: string; back: string; isNew: boolean }
interface Session { cards: Card[]; due: number; newToday: number; seen: number; total: number; nextDue: string | null }
type Rating = "Again" | "Hard" | "Good" | "Easy";

const RATINGS: { r: Rating; key: string; hint: string; cls: string }[] = [
  { r: "Again", key: "1", hint: "forgot", cls: "border-redpen/50 text-redpen hover:bg-redpen/8" },
  { r: "Hard", key: "2", hint: "slow", cls: "border-mastery-mid/60 text-amber-ink hover:bg-mastery-mid/10" },
  { r: "Good", key: "3", hint: "got it", cls: "border-ink/30 text-ink hover:bg-accent" },
  { r: "Easy", key: "4", hint: "instant", cls: "border-mastery-high/50 text-mastery-high hover:bg-mastery-high/10" },
];

const when = (iso: string) => {
  const d = new Date(iso);
  const hrs = (d.getTime() - Date.now()) / 3600_000;
  if (hrs < 1) return "in under an hour";
  if (hrs < 24) return `in ${Math.round(hrs)} hours`;
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
};

export function CardsClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState<{ id: string; rating: Rating }[]>([]);
  const [again, setAgain] = useState<Card[]>([]); // "Again" cards come back once at the end of this session
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/cards");
      if (!r.ok) throw new Error(String(r.status));
      setSession(await r.json());
      setI(0);
      setFlipped(false);
      setDone([]);
      setAgain([]);
    } catch {
      setError("Couldn't load your cards. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const queue = session ? [...session.cards, ...again] : [];
  const card = queue[i];

  const rate = async (rating: Rating) => {
    if (!card || busy || !flipped) return;
    setBusy(true);
    try {
      await fetch("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId: card.id, rating }) });
      setDone((d) => [...d, { id: card.id, rating }]);
      if (rating === "Again" && i < (session?.cards.length ?? 0)) setAgain((a) => [...a, card]);
      setI((n) => n + 1);
      setFlipped(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) void rate(r.r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <p className="margin-note text-left">{error}</p>
        <Button className="mt-4" onClick={() => void load()}><RotateCcw className="size-4" /> Try again</Button>
      </div>
    );
  }
  if (!session) return <PenLoader label="Shuffling the deck…" className="mx-auto mt-16" />;

  const header = (
    <header>
      <Link href="/learn" className="block w-fit text-sm text-ink-soft hover:text-ink">← Concept cards</Link>
      <h1 className="hand-underline mt-2 text-4xl sm:text-5xl">Formula flashcards</h1>
      <p className="mt-3 text-ink-soft">
        {session.total} cards on formulas and CAT shortcuts. Rate how well you knew each one and it comes back just before you&apos;d forget it.
        <span className="ml-1 font-mono text-sm">{session.seen}/{session.total} started</span>
      </p>
    </header>
  );

  /* ── finished (or nothing due) ── */
  if (!card) {
    const knew = done.filter((d) => d.rating === "Good" || d.rating === "Easy").length;
    return (
      <div className="mx-auto max-w-xl space-y-6">
        {header}
        <section className="paper-card p-8 text-center">
          <Layers className="mx-auto size-8 text-redpen" aria-hidden="true" />
          <h2 className="mt-3 text-3xl">{done.length ? "Done for today" : "Nothing due right now"}</h2>
          <p className="mt-2 text-ink-soft">
            {done.length ? `${done.length} reviewed, ${knew} known cold. ` : ""}
            {session.nextDue ? `Next card is due ${when(session.nextDue)}.` : done.length ? "" : "New cards unlock tomorrow."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/today" className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85">Back to Today <ArrowRight className="size-4" /></Link>
            <Button variant="outline" onClick={() => void load()}><RotateCcw className="size-4" /> Check again</Button>
          </div>
        </section>
      </div>
    );
  }

  /* ── a card ── */
  return (
    <div className="mx-auto max-w-xl space-y-5">
      {header}
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>{i + 1} of {queue.length}{card.isNew && i < session.cards.length ? " · new" : ""}</span>
        <span>{session.due} due · {session.newToday} new today</span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Card answer. Press space to flip back" : "Card front. Press space to see the answer"}
        className="paper-card block min-h-64 w-full p-6 text-left transition-shadow hover:shadow-md sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{card.conceptName} · {card.kind}</p>
        <p className="mt-3 text-2xl leading-snug text-ink">{card.front}</p>
        {flipped ? (
          <div className="mt-5 border-t border-dashed border-border pt-4 text-base leading-relaxed text-ink sm:text-lg [&_.katex-display]:text-[0.85em] sm:[&_.katex-display]:text-[1em]" aria-live="polite">
            <MathText text={card.back} />
          </div>
        ) : (
          <p className="mt-8 text-sm text-ink-soft">Say it to yourself, then tap (or press space) to check.</p>
        )}
      </button>
      {flipped ? (
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
          {RATINGS.map((x) => (
            <button key={x.r} type="button" disabled={busy} onClick={() => void rate(x.r)} className={cn("rounded-xl border bg-card px-2 py-3 text-center transition-colors disabled:opacity-60", x.cls)}>
              <span className="block font-medium">{x.r}</span>
              <span className="block text-xs opacity-80">{x.hint} · {x.key}</span>
            </button>
          ))}
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => setFlipped(true)}>Show the answer</Button>
      )}
    </div>
  );
}
