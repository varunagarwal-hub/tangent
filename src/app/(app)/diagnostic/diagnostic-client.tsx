"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/tangent/question-card";
import { Timer } from "@/components/tangent/timer";
import { ConfidencePicker } from "@/components/tangent/confidence-picker";
import { WorkInput } from "@/components/tangent/work-input";
import { TraceDock } from "@/components/tangent/trace-panel";
import { PenLoader } from "@/components/tangent/pen-loader";
import { MiniMap } from "@/components/tangent/mini-map";
import { useAnswerFlow } from "@/lib/client/answer-flow";
import { SAMPLE_WORK } from "@/lib/samples";
import type { Confidence, MasteryNode, PublicQuestion, TraceStep, WorkPayload } from "@/lib/api-types";

interface Asked {
  conceptId: string;
  correct: boolean;
  questionId: string;
}

export const REVEAL_KEY = "tangent-reveal";

export function DiagnosticClient() {
  const router = useRouter();
  const [asked, setAsked] = useState<Asked[]>([]);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [total, setTotal] = useState(12);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [work, setWork] = useState<WorkPayload>({ source: "none" });
  const [startedAt, setStartedAt] = useState(0);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [nodes, setNodes] = useState<MasteryNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTrace = useCallback((s: TraceStep) => setTrace((t) => [...t, s]), []);
  const flow = useAnswerFlow({ onTrace, quick: true });

  const refreshMap = useCallback(async () => {
    try {
      const r = await fetch("/api/mastery");
      if (r.ok) setNodes((await r.json()).nodes);
    } catch {}
  }, []);

  const finish = useCallback(
    async (all: Asked[]) => {
      setBusy(true);
      try {
        const r = await fetch("/api/diagnostic/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ results: all.map(({ conceptId, correct }) => ({ conceptId, correct })) }),
        });
        const data = r.ok ? await r.json() : null;
        try {
          sessionStorage.setItem(REVEAL_KEY, JSON.stringify({ ...data, results: all }));
        } catch {}
      } finally {
        router.push("/reveal");
      }
    },
    [router],
  );

  const loadNext = useCallback(
    async (all: Asked[]) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/diagnostic/next", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ asked: all }),
        });
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (data.done) return finish(all);
        setQuestion(data.question);
        setTotal(data.total);
        setTrace((t) => [...t, ...data.trace]);
        setAnswer("");
        setConfidence(null);
        setWork({ source: "none" });
        flow.reset();
        setStartedAt(Date.now());
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("Couldn't load the next question.");
      } finally {
        setBusy(false);
      }
    },
    [finish, flow],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // React dev double-invokes effects
    started.current = true;
    void loadNext([]);
    void refreshMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit() {
    if (!question || !answer.trim()) return;
    const timeSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const res = await flow.submit(question, { answer, timeSec, confidence, mode: "diagnostic", work: work.source === "none" ? undefined : work });
    if (res) {
      setAsked((a) => [...a, { conceptId: question.conceptId, correct: res.correct, questionId: question.id }]);
      void refreshMap();
    }
  }

  if (!question) {
    return error ? (
      <div className="paper-card mx-auto max-w-lg p-8 text-center">
        <p className="margin-note">{error}</p>
        <Button className="mt-4" onClick={() => loadNext(asked)}>
          Retry
        </Button>
      </div>
    ) : (
      <PenLoader label="Choosing your first question…" className="mx-auto mt-16" />
    );
  }

  const r = flow.result;
  const submitted = flow.phase !== "answering";
  const index = asked.length - (submitted && r ? 1 : 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-redpen">Diagnostic</p>
            <h1 className="text-3xl sm:text-4xl">Let&apos;s map how you think</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              12 questions that adapt as you go. Miss one and the next checks the foundation underneath it. Show your working if you can: Tangent reads it.
            </p>
          </div>
          {/* progress dots */}
          <ol className="flex gap-1.5" aria-label={`Question ${index + 1} of ${total}`}>
            {Array.from({ length: total }, (_, i) => {
              const a = asked[i];
              return (
                <li
                  key={i}
                  className={`size-2.5 rounded-full border ${a ? (a.correct ? "border-mastery-high bg-mastery-high" : "border-redpen bg-redpen") : i === index ? "border-ink bg-ink/30" : "border-ink/30"}`}
                  title={a ? (a.correct ? "Correct" : "Incorrect") : i === index ? "Current" : "Upcoming"}
                />
              );
            })}
          </ol>
        </div>

        <QuestionCard
          question={question}
          value={answer}
          onChange={setAnswer}
          disabled={submitted}
          index={index + 1}
          total={total}
          result={r ? { correct: r.correct, correctAnswer: r.correctAnswer } : null}
        />

        {!submitted && (
          <div className="paper-card space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ConfidencePicker value={confidence} onChange={setConfidence} />
              {startedAt > 0 && <Timer startedAt={startedAt} targetSec={question.targetTimeSec} />}
            </div>
            <WorkInput value={work} onChange={setWork} samples={SAMPLE_WORK} />
            <div className="flex justify-end">
              <Button size="lg" onClick={onSubmit} disabled={!answer.trim()}>
                Submit <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {submitted && (
          <div className="paper-card flex flex-wrap items-center gap-3 p-4" role="status">
            {r ? (
              <>
                {r.correct ? <CheckCircle2 className="size-6 text-mastery-high" /> : <XCircle className="size-6 text-redpen" />}
                <p className="flex-1">
                  <span className="font-serif text-2xl">{r.correct ? "Correct." : "Not quite."}</span>{" "}
                  {flow.diagnosis?.misconceptionName && (
                    <span className="margin-note block text-lg">Off on a tangent: {flow.diagnosis.misconceptionName}</span>
                  )}
                </p>
              </>
            ) : (
              <PenLoader label="Marking…" />
            )}
            {flow.phase === "diagnosing" && <PenLoader label="Reading your working…" />}
            {(flow.phase === "done" || flow.phase === "confirm") && (
              <Button size="lg" className="ml-auto" onClick={() => loadNext(asked)} disabled={busy}>
                {asked.length >= total ? "See my Mastery Map" : "Next"} <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="paper-card overflow-hidden p-4">
          <p className="mb-3 font-serif text-xl">Your map, filling in</p>
          {nodes.length ? <MiniMap nodes={nodes} highlight={question.conceptId} /> : <PenLoader label="Drawing the map…" />}
        </div>
        <TraceDock steps={trace} running={busy || flow.phase === "grading" || flow.phase === "diagnosing"} />
      </aside>
    </div>
  );
}
