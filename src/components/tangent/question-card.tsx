"use client";

import { useId, useRef } from "react";
import { Check, X } from "lucide-react";
import type { PublicQuestion } from "@/lib/api-types";
import { answersMatch } from "@/lib/grading";
import { Badge } from "@/components/ui/badge";
import { MathText } from "./math-text";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export interface QuestionResult {
  correct: boolean;
  correctAnswer: string;
}

function optionMatches(option: string, index: number, answer: string) {
  const a = answer.trim();
  if (/^[A-Fa-f]$/.test(a)) return a.toUpperCase() === LETTERS[index];
  return answersMatch(option, a);
}

/** A question on a paper card: header chips, MathText stem, MCQ rows (arrows + A–D keys) or a TITA input. */
export function QuestionCard({
  question,
  value,
  onChange,
  disabled,
  result,
  index,
  total,
  className,
}: {
  question: PublicQuestion;
  value: string;
  onChange: (answer: string) => void;
  disabled?: boolean;
  result?: QuestionResult | null;
  index?: number;
  total?: number;
  className?: string;
}) {
  const id = useId();
  const options = question.type === "MCQ" ? (question.options ?? []) : [];
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const locked = disabled || !!result;
  const selectedIdx = options.findIndex((o) => o === value);

  function select(i: number, focus = true) {
    if (locked || i < 0 || i >= options.length) return;
    onChange(options[i]);
    if (focus) optionRefs.current[i]?.focus();
  }

  function onCardKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (question.type !== "MCQ" || locked || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, [contenteditable='true']")) return;
    const i = LETTERS.indexOf(e.key.toUpperCase());
    if (i >= 0 && i < options.length) {
      e.preventDefault();
      select(i);
    }
  }

  function onOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = options.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      if (locked) optionRefs.current[next]?.focus();
      else select(next);
    }
  }

  const titaState = result && question.type === "TITA" ? (result.correct ? "right" : "wrong") : null;
  const focusIdx = selectedIdx >= 0 ? selectedIdx : 0;

  return (
    <article className={cn("paper-card flex flex-col gap-4 p-4 sm:p-6", className)} onKeyDown={onCardKeyDown} aria-labelledby={`${id}-stem`}>
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="h-6 border-ink/25 bg-highlighter/60 text-ink">
          {question.conceptName}
        </Badge>
        <span className="text-ink-soft">{question.area}</span>
        <Badge variant="secondary" className="h-6 font-mono" title={question.type === "MCQ" ? "Multiple choice" : "Type in the answer"}>
          {question.type}
        </Badge>
        {index != null && total != null && (
          <span className="ml-auto font-mono text-ink-soft tabular-nums">
            Q {index} of {total}
          </span>
        )}
      </header>

      <div id={`${id}-stem`} className="text-base leading-relaxed text-ink sm:text-lg">
        <MathText text={question.stem} />
      </div>

      {question.type === "MCQ" ? (
        <div role="radiogroup" aria-labelledby={`${id}-stem`} aria-describedby={`${id}-hint`} className="flex flex-col gap-2">
          {options.map((opt, i) => {
            const chosen = i === selectedIdx;
            const isCorrect = !!result && optionMatches(opt, i, result.correctAnswer);
            const isWrongPick = !!result && chosen && !isCorrect;
            return (
              <button
                key={i}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt.replace(/[$\\]/g, "")}${isCorrect ? " (correct answer)" : isWrongPick ? " (your answer, incorrect)" : ""}`}
                aria-disabled={locked || undefined}
                tabIndex={i === focusIdx ? 0 : -1}
                onClick={() => select(i, false)}
                onKeyDown={(e) => onOptionKeyDown(e, i)}
                className={cn(
                  "group flex min-h-12 w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-ink transition-colors",
                  !locked && "hover:border-ink/40 hover:bg-accent",
                  chosen && !result && "border-ink bg-accent ring-1 ring-ink",
                  isCorrect && "border-mastery-high bg-mastery-high/10",
                  isWrongPick && "border-redpen/60 bg-redpen/5",
                  locked && !isCorrect && !isWrongPick && "opacity-70",
                  locked && "cursor-default",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm",
                    chosen && !result && "border-ink bg-ink text-paper",
                    isCorrect && "border-mastery-high bg-mastery-high text-paper",
                    isWrongPick && "border-redpen text-redpen",
                  )}
                >
                  {LETTERS[i]}
                </span>
                <span className={cn("relative min-w-0 flex-1", isWrongPick && "line-through decoration-redpen decoration-2")}>
                  <MathText text={opt} />
                </span>
                {isCorrect && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-mastery-high">
                    <Check className="size-5" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Correct</span>
                  </span>
                )}
                {isWrongPick && (
                  <span className="inline-flex items-center gap-1 font-hand text-xl text-redpen">
                    <X className="size-5" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Your pick</span>
                  </span>
                )}
              </button>
            );
          })}
          <p id={`${id}-hint`} className="hidden text-xs text-ink-soft sm:block">
            Tip: press A–D to choose, or use the arrow keys.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-tita`} className="text-sm font-medium text-ink">
            Type your answer (no negative marking)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={`${id}-tita`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              disabled={locked}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={titaState === "wrong" || undefined}
              className={cn(
                "h-12 w-full max-w-xs rounded-lg border bg-card px-3 font-mono text-lg text-ink outline-none focus-visible:border-ink disabled:opacity-90",
                titaState === "right" && "border-mastery-high bg-mastery-high/10",
                titaState === "wrong" && "border-redpen/60 text-redpen line-through decoration-redpen decoration-2",
              )}
            />
            {titaState === "right" && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-mastery-high">
                <Check className="size-5" aria-hidden="true" /> Correct
              </span>
            )}
            {titaState === "wrong" && result && (
              <span className="inline-flex flex-wrap items-center gap-1 text-sm text-ink">
                <X className="size-5 text-redpen" aria-hidden="true" />
                <span className="text-redpen">Not quite.</span>
                <span className="inline-flex items-center gap-1">
                  Answer:
                  <span className="font-mono font-semibold text-mastery-high">
                    <MathText text={result.correctAnswer} />
                  </span>
                  <Check className="size-4 text-mastery-high" aria-hidden="true" />
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {result && (
        <p className="sr-only" role="status">
          {result.correct ? "Correct." : `Incorrect. The correct answer is ${result.correctAnswer}.`}
        </p>
      )}
    </article>
  );
}
