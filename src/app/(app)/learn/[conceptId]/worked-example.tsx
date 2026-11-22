"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/tangent/math-text";

/** Worked example revealed one step at a time. */
export function WorkedExample({ example }: { example: { question: string; steps: string[]; answer: string } }) {
  const [shown, setShown] = useState(0);
  const all = shown >= example.steps.length;

  return (
    <section className="paper-card p-5" aria-labelledby="worked">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="worked" className="text-2xl">Worked example</h2>
        <span className="inline-flex items-center gap-1 text-xs text-mastery-high">
          <Check className="size-3.5" aria-hidden="true" /> answer checked by a second model
        </span>
      </div>
      <MathText text={example.question} className="mt-2 block text-lg leading-relaxed text-ink" />
      <p className="mt-2 text-sm text-ink-soft">Try it first. Then reveal the solution one step at a time.</p>

      <ol className="mt-4 space-y-2" aria-live="polite">
        {example.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 border-l-2 border-redpen/40 pl-3">
            <span className="font-mono text-sm text-ink-soft">{i + 1}</span>
            <MathText text={s} className="leading-relaxed text-ink" />
          </li>
        ))}
      </ol>

      {all ? (
        <p className="mt-4 font-semibold text-ink">
          Answer: <MathText text={example.answer} />
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShown((n) => n + 1)}>
            <ChevronDown className="size-4" /> {shown === 0 ? "Show the first step" : "Next step"}
          </Button>
          {shown > 0 && (
            <Button variant="ghost" onClick={() => setShown(example.steps.length)}>
              Show all
            </Button>
          )}
          <span className="self-center font-mono text-xs text-ink-soft">
            {shown}/{example.steps.length}
          </span>
        </div>
      )}
    </section>
  );
}
