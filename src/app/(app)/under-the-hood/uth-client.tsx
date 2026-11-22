"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnderTheHoodData } from "@/lib/api-types";
import { PenLoader } from "@/components/tangent/pen-loader";
import { SectionHeading, fetchJson } from "@/components/tangent/teacher/shared";
import { Architecture } from "@/components/tangent/uth/architecture";
import { AgentCards, Algorithms, Counts, DetectiveEval, FeedRow, Loops, VerifierCard } from "@/components/tangent/uth/sections";

export function UnderTheHoodClient() {
  const [data, setData] = useState<UnderTheHoodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson<UnderTheHoodData>("/api/under-the-hood"));
      setNow(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(id);
  }, [load]);

  const ranAtLabel = data?.eval?.ranAt
    ? new Date(data.eval.ranAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-14">
      <header>
        <p className="font-hand text-2xl text-redpen">for the judges</p>
        <h1 className="mt-1 text-4xl text-ink sm:text-5xl">Under the hood</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Seven agents around one deterministic learner model. The math (mastery, difficulty, scheduling) is code; the judgment
          (reading, diagnosing, writing, explaining) is Gemini. Everything below is live from the database.
        </p>
      </header>

      <section aria-labelledby="arch-title">
        <SectionHeading id="arch-title" title="The agent loop" />
        <div className="mt-4">
          <Architecture />
        </div>
      </section>

      {error && !data ? (
        <p className="margin-note">Couldn&apos;t load live stats: {error}</p>
      ) : !data ? (
        <div className="flex justify-center py-16">
          <PenLoader label="Reading the logs" />
        </div>
      ) : (
        <>
          <Counts c={data.counts} />

          <section aria-labelledby="agents-title">
            <SectionHeading id="agents-title" title="The seven agents" />
            <div className="mt-4">
              <AgentCards perAgent={data.perAgent} />
            </div>
          </section>

          <section aria-labelledby="eval-title" className="grid gap-5 lg:grid-cols-2">
            <h2 id="eval-title" className="sr-only">
              Evaluation
            </h2>
            <DetectiveEval ev={data.eval} ranAtLabel={ranAtLabel} />
            <VerifierCard v={data.verifier} />
          </section>

          <section aria-labelledby="algo-title">
            <SectionHeading id="algo-title" title="The algorithms, in plain English" />
            <div className="mt-4">
              <Algorithms />
            </div>
          </section>

          <section aria-labelledby="loops-title">
            <SectionHeading id="loops-title" title="Feedback loops" />
            <div className="mt-4">
              <Loops />
            </div>
          </section>

          <section aria-labelledby="builders-title">
            <SectionHeading id="builders-title" title="Offline content builders" />
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              The newer features need no AI at request time. Their content is generated once, checked by a second model, and committed. The same
              generator → independent verifier pattern as the question bank.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { name: "Spot the Tangent rounds", out: "105 rounds", how: "Flash rewrites each misconception example as 4–7 lines with the slip on a random line; Pro finds the first wrong line on its own. Kept only when they agree (105/105)." },
                { name: "Concept cards", out: "27 cards", how: "Flash writes the key idea, formulas, worked example and shortcuts; Pro re-solves the worked example and the card is kept only if the answers match." },
                { name: "Foundation questions", out: "80 MCQs", how: "Flash writes school-level questions for 8 skills; Pro answers each independently. Options are shown in a fixed shuffled order so the key's position can't be guessed." },
                { name: "Formula flashcards", out: "130 cards", how: "Built from the concept cards; Pro reviews each concept's set and flags anything wrong or misleading. 5 shortcuts were dropped, from the cards and the flashcards." },
              ].map((b) => (
                <li key={b.name} className="paper-card p-4">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{b.name}</span>
                    <span className="font-mono text-xs text-ink-soft">{b.out}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.how}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="feed-title">
            <SectionHeading id="feed-title" title="Live agent feed" />
            <p className="mt-1 text-sm text-ink-soft">The latest agent runs, refreshed every 15 seconds.</p>
            {data.feed.length === 0 ? (
              <p className="margin-note mt-4">No agent runs yet. Try a practice question.</p>
            ) : (
              <ul className="paper-card mt-4 divide-y divide-dashed divide-border overflow-hidden p-0">
                {data.feed.map((r) => (
                  <FeedRow key={r.id} r={r} now={now} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
