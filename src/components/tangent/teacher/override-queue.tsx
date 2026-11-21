"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, PencilLine, X } from "lucide-react";
import type { OverrideItem } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MathText } from "@/components/tangent/math-text";
import { cn } from "@/lib/utils";
import { postJson } from "./shared";

type RelabelBody = { attemptId: string; action: "confirm" | "relabel"; misconceptionId?: string; note?: string };
type RelabelResult = { ok: true; teacherCorrections: number };

/** Student work, one line per row, with the detective's error line underlined in red pen. */
function Work({ text, errorLine }: { text: string; errorLine: string | null }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const err = errorLine?.trim().toLowerCase();
  const norm = (l: string) => l.trim().toLowerCase();
  let hitIdx = err ? lines.findIndex((l) => norm(l) === err) : -1;
  if (err && hitIdx < 0) hitIdx = lines.findIndex((l) => norm(l).includes(err) || (norm(l).length > 3 && err.includes(norm(l))));
  return (
    <div className="graph-paper rounded-md border px-3 py-2">
      {lines.map((l, i) => {
        const hit = i === hitIdx;
        return (
          <p key={i} className="font-hand text-xl leading-snug text-ink">
            <span className={cn(hit && "tg-error-line")}>{l}</span>
            {hit && <span className="ml-2 text-base text-redpen">← tangent point</span>}
          </p>
        );
      })}
    </div>
  );
}

function ConfidencePill({ c }: { c: number | null }) {
  if (c == null) return <span className="text-xs text-ink-soft">confidence unknown</span>;
  const v = Math.round(c * 100);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", v < 50 ? "bg-redpen" : v < 70 ? "bg-mastery-mid" : "bg-mastery-high")} style={{ width: `${v}%` }} />
      </span>
      <span className="font-mono tabular-nums text-ink">{v}%</span>
      <span className="text-ink-soft">sure</span>
    </span>
  );
}

function QueueItem({ item, onDone }: { item: OverrideItem; onDone: (attemptId: string, count: number, action: "confirm" | "relabel") => void }) {
  const [mode, setMode] = useState<"view" | "relabel">("view");
  const [choice, setChoice] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: RelabelBody) {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<RelabelResult>("/api/teacher/relabel", body);
      onDone(item.attemptId, res.teacherCorrections, body.action);
    } catch (e) {
      setError(`Couldn't save (${(e as Error).message}). Try again.`);
      setBusy(false);
    }
  }

  const candidates = item.candidates.filter((c) => c.id !== item.misconceptionId);
  const pickerId = `relabel-${item.attemptId}`;

  return (
    <article className="paper-card flex flex-col gap-3 p-4" aria-label={`Diagnosis for ${item.studentName}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-ink">
          {item.studentName}
          <span className="ml-2 text-xs font-normal text-ink-soft">
            <span className="font-mono">{item.conceptId}</span> {item.conceptName}
          </span>
        </p>
        <ConfidencePill c={item.confidence} />
      </header>

      <p className="text-sm text-ink">
        <MathText text={item.questionStem} />
      </p>

      {item.workText ? (
        <Work text={item.workText} errorLine={item.errorLine} />
      ) : item.errorLine ? (
        <p className="font-hand text-xl">
          <span className="tg-error-line">{item.errorLine}</span>
        </p>
      ) : (
        <p className="text-xs text-ink-soft">No written work on this attempt{item.studentAnswer ? ` · answered ${item.studentAnswer.replace(/\$/g, "")}` : ""}.</p>
      )}
      {item.workText && item.studentAnswer && (
        <p className="text-xs text-ink-soft">
          Final answer: <MathText text={item.studentAnswer} className="font-mono text-ink" />
        </p>
      )}

      <div className="rounded-md border border-dashed border-redpen/40 bg-redpen/5 px-3 py-2">
        <p className="text-xs tracking-wide text-ink-soft uppercase">Detective says</p>
        <p className="margin-note">{item.misconceptionName ?? "Unlabelled slip"}</p>
      </div>

      {mode === "view" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={busy} onClick={() => send({ attemptId: item.attemptId, action: "confirm", misconceptionId: item.misconceptionId ?? undefined })}>
            <Check aria-hidden="true" /> Confirm
          </Button>
          <Button size="lg" variant="outline" disabled={busy} onClick={() => setMode("relabel")}>
            <PencilLine aria-hidden="true" /> Relabel
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!choice) return;
            send({ attemptId: item.attemptId, action: "relabel", misconceptionId: choice, note: note.trim() || undefined });
          }}
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium text-ink">What actually went wrong?</legend>
            {candidates.length === 0 && <p className="text-xs text-ink-soft">No other misconceptions are catalogued for this concept.</p>}
            {candidates.map((c) => (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-redpen",
                  choice === c.id ? "border-redpen bg-redpen/8 text-ink" : "hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name={pickerId}
                  value={c.id}
                  checked={choice === c.id}
                  onChange={() => setChoice(c.id)}
                  className="mt-1 accent-[var(--redpen)]"
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm text-ink">
            <span>
              Note for the detective <span className="text-ink-soft">(optional)</span>
            </span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. They added the percentages instead of compounding them"
              className="min-h-16 font-hand text-xl"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={busy || !choice}>
              <PencilLine aria-hidden="true" /> Save relabel
            </Button>
            <Button type="button" size="lg" variant="ghost" disabled={busy} onClick={() => setMode("view")}>
              <X aria-hidden="true" /> Cancel
            </Button>
          </div>
        </form>
      )}
      {busy && <p className="text-sm font-medium text-ink-soft" role="status">Saving…</p>}
      {error && (
        <p className="text-sm text-redpen" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function OverrideQueue({ items, onCorrection }: { items: OverrideItem[]; onCorrection: (count: number) => void }) {
  const reduced = useReducedMotion();
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [flash, setFlash] = useState<{ key: number; text: string } | null>(null);

  const visible = items.filter((i) => !doneIds.has(i.attemptId));

  function handleDone(id: string, count: number, action: "confirm" | "relabel") {
    setDoneIds((s) => new Set(s).add(id));
    onCorrection(count);
    setFlash((f) => ({
      key: (f?.key ?? 0) + 1,
      text: action === "relabel" ? "Saved: the detective will use this as an example." : "Confirmed: the detective will use this as an example.",
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" className="min-h-0">
        <AnimatePresence mode="wait">
          {flash && (
            <motion.p
              key={flash.key}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-md border border-mastery-high/40 bg-mastery-high/10 px-3 py-2 text-sm text-ink"
            >
              <Check className="size-4 text-mastery-high" aria-hidden="true" />
              {flash.text}
              <span className="text-sm font-medium text-ink-soft">(feedback loop 8)</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {visible.length === 0 && (
        <p className="font-hand text-xl text-ink-soft">Queue clear. Every low-confidence diagnosis has a teacher&apos;s mark on it.</p>
      )}
      <ul className="grid items-start gap-3 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.attemptId}
              layout={!reduced}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.96, transition: { duration: 0.3 } }}
              className="min-w-0"
            >
              <QueueItem item={item} onDone={handleDone} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
