"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, MessageCircleQuestion, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuestionCard } from "@/components/tangent/question-card";
import { Timer } from "@/components/tangent/timer";
import { ConfidencePicker } from "@/components/tangent/confidence-picker";
import { WorkInput } from "@/components/tangent/work-input";
import { RedPenWork } from "@/components/tangent/red-pen-work";
import { TraceDock } from "@/components/tangent/trace-panel";
import { PenLoader } from "@/components/tangent/pen-loader";
import { MathText } from "@/components/tangent/math-text";
import { useAnswerFlow } from "@/lib/client/answer-flow";
import { SAMPLE_WORK } from "@/lib/samples";
import type { Confidence, NextAction, TraceStep, WorkLine, WorkPayload } from "@/lib/api-types";
import { PageIntro } from "@/components/tangent/page-intro";
import { SessionRecap, type SessionEntry } from "@/components/tangent/session-recap";
import { markDemoStep } from "@/components/tangent/demo-guide/events";

const KIND_LABEL: Record<string, string> = {
  contrast_question: "Contrast question",
  prerequisite_drill: "Prerequisite drill",
  review: "Review",
  practice: "Practice",
  stretch: "Stretch",
  diagnostic: "Diagnostic",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function PracticeClient() {
  const [action, setAction] = useState<NextAction | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [work, setWork] = useState<WorkPayload>({ source: "none" });
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [disagreeOpen, setDisagreeOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDraft, setConfirmDraft] = useState<WorkLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionEntry[]>([]);

  const onTrace = useCallback((s: TraceStep) => setTrace((t) => [...t, s]), []);
  const flow = useAnswerFlow({ onTrace });

  const loadNext = useCallback(
    async (last?: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams();
        if (last) qs.set("last", last);
        if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "review") qs.set("mode", "review");
        const res = await fetch(`/api/next${qs.size ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error(String(res.status));
        const a: NextAction = await res.json();
        setAction(a);
        setTrace(a.trace);
        setAnswer("");
        setConfidence(null);
        setWork({ source: "none" });
        setShowSolution(false);
        setDisagreeOpen(false);
        setNote("");
        flow.reset();
        setStartedAt(Date.now());
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setLoadError("Couldn't load the next question. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [flow],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // React dev double-invokes effects
    started.current = true;
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flow.phase === "confirm") setConfirmDraft(flow.lines);
  }, [flow.phase, flow.lines]);

  // Guided demo: the red-pen step is done once the detective has marked up a piece of work.
  useEffect(() => {
    if (flow.phase === "done" && flow.diagnosis?.errorLineNumber != null) markDemoStep("redpen");
  }, [flow.phase, flow.diagnosis]);

  async function onSubmit() {
    if (!action || !answer.trim()) return;
    const timeSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    setElapsed(timeSec);
    const mode = action.kind === "contrast_question" ? "contrast" : action.kind === "review" ? "review" : "practice";
    await flow.submit(action.question, {
      answer,
      timeSec,
      confidence,
      mode,
      work: work.source === "none" ? undefined : work,
    });
  }

  if (loadError && !action) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <p className="margin-note">{loadError}</p>
        <Button className="mt-4" onClick={() => loadNext()}>
          <RotateCcw className="size-4" /> Retry
        </Button>
      </div>
    );
  }
  if (!action) return <PenLoader label="Planning your next question…" className="mx-auto mt-16" />;

  const submitted = flow.phase !== "answering";
  const r = flow.result;
  const d = flow.diagnosis;

  // This attempt, once marked, counts toward the session (it's committed to `session` on "Next question").
  const current: SessionEntry | null =
    flow.phase === "done" && r
      ? {
          attemptId: r.attemptId,
          conceptName: action.conceptName,
          correct: r.correct,
          masteryBefore: r.masteryBefore,
          masteryAfter: r.masteryAfter,
          misconceptionName: !r.correct || d?.reasoningVerdict === "flawed" ? (d?.misconceptionName ?? null) : null,
          flawed: d?.reasoningVerdict === "flawed",
        }
      : null;
  const sessionView = current && !session.some((e) => e.attemptId === current.attemptId) ? [...session, current] : session;
  const showRecap = !!current && sessionView.length > 0 && sessionView.length % 5 === 0;
  const goNext = () => {
    if (current) setSession((s) => (s.some((e) => e.attemptId === current.attemptId) ? s : [...s, current]));
    void loadNext(action.conceptId);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <PageIntro
          id="practice"
          steps={[
            "Pick an answer and say how sure you are.",
            "Show your rough work: draw, type, upload a photo, or use the sample.",
            "Submit: Tangent circles the exact line where your reasoning went wrong, then picks your next question.",
          ]}
        />
        {/* Why this question? */}
        <div className="paper-card flex flex-col gap-1 border-l-4 border-l-redpen p-4">
          <span className="text-[0.78rem] font-semibold uppercase tracking-wide text-redpen">
            {KIND_LABEL[action.kind]} · {action.conceptName}
          </span>
          <p className="text-[0.95rem] leading-relaxed text-ink">
            <span className="sr-only">Why this question? </span>
            {action.why}
          </p>
        </div>

        <QuestionCard
          question={action.question}
          value={answer}
          onChange={setAnswer}
          disabled={submitted}
          result={r ? { correct: r.correct, correctAnswer: r.correctAnswer } : null}
        />

        {!submitted && (
          <div className="paper-card space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ConfidencePicker value={confidence} onChange={setConfidence} />
              {startedAt > 0 && <Timer startedAt={startedAt} targetSec={action.question.targetTimeSec} />}
            </div>
            <WorkInput value={work} onChange={setWork} samples={SAMPLE_WORK} />
            <div className="flex justify-end">
              <Button size="lg" onClick={onSubmit} disabled={!answer.trim()}>
                Submit answer <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {flow.phase === "grading" && <PenLoader label="Marking…" />}

        {r && (
          <div
            className={`paper-card flex flex-wrap items-center gap-3 p-4 ${r.correct ? "border-mastery-high/50" : "border-redpen/50"}`}
            role="status"
          >
            {r.correct ? <CheckCircle2 className="size-6 text-mastery-high" /> : <XCircle className="size-6 text-redpen" />}
            <div className="flex-1">
              <p className="font-serif text-2xl">{r.correct ? "Correct." : "Not quite."}</p>
              <p className="text-sm text-ink-soft">
                {action.conceptName} mastery{" "}
                <span className="font-mono">
                  {pct(r.masteryBefore)} → {pct(r.masteryAfter)}
                </span>{" "}
                · {elapsed}s
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowSolution((v) => !v)}>
              <BookOpen className="size-4" /> {showSolution ? "Hide solution" : "Show solution"}
            </Button>
          </div>
        )}

        {flow.phase === "diagnosing" && <PenLoader label="The detective is reading your working…" />}

        {flow.phase === "confirm" && (
          <div className="paper-card space-y-3 p-4">
            <p className="font-serif text-xl">Here&apos;s what I read</p>
            <p className="text-sm text-ink-soft">Fix anything I misread, then confirm. I&apos;ll check the reasoning line by line.</p>
            <ol className="space-y-2">
              {confirmDraft.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 text-right font-mono text-sm text-ink-soft">{i + 1}</span>
                  <input
                    className="flex-1 rounded-md border bg-card px-3 py-1.5 font-hand text-xl"
                    value={l.text}
                    aria-label={`Line ${i + 1}`}
                    onChange={(e) => setConfirmDraft((ls) => ls.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  />
                </li>
              ))}
            </ol>
            <Button onClick={() => flow.confirmLines(confirmDraft)}>Looks right, check my reasoning</Button>
          </div>
        )}

        {flow.phase === "done" && d && (
          <div className="space-y-3">
            {flow.lines.length > 0 ? (
              <RedPenWork
                lines={flow.lines}
                errorLine={d.errorLineNumber}
                note={d.explanation}
                verdict={d.reasoningVerdict}
              />
            ) : (
              <div className="paper-card p-4">
                <p className="margin-note">{d.explanation}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {d.misconceptionName && (
                <span className="rounded-full border border-redpen/40 bg-redpen/10 px-3 py-1 text-redpen">
                  Off on a tangent: {d.misconceptionName}
                  {d.lifecycle === "detected" && " · logged in your Mistake Journal"}
                  {d.lifecycle === "fixing" && " · being fixed"}
                </span>
              )}
              {d.lifecycle === "resolved" && (
                <span className="rounded-full border border-mastery-high/40 bg-mastery-high/10 px-3 py-1 text-mastery-high">
                  ✓ Back on the curve: misconception resolved
                </span>
              )}
              {d.novelDescription && <span className="rounded-full border px-3 py-1">New pattern: {d.novelDescription}</span>}
              {d.fewshotFromTeachers > 0 && (
                <span className="rounded-full border px-3 py-1 text-ink-soft">
                  Detective learned from {d.fewshotFromTeachers} teacher correction{d.fewshotFromTeachers === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        )}

        {flow.error && <p className="margin-note">{flow.error}</p>}

        {showSolution && r && (
          <div className="paper-card p-4">
            <p className="mb-2 text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">Full solution</p>
            <MathText text={r.solution} className="leading-relaxed" />
          </div>
        )}

        {showRecap && <SessionRecap entries={sessionView} />}

        {flow.phase === "done" && (
          <div className="flex flex-wrap items-center gap-3">
            {r && (!r.correct || d?.reasoningVerdict === "flawed" || d?.unsure) && !disagreeOpen && (
              <Button variant="ghost" onClick={() => setDisagreeOpen(true)}>
                <MessageCircleQuestion className="size-4" /> {d?.unsure ? "Tell me your approach" : "That's not why I got it wrong"}
              </Button>
            )}
            <Button size="lg" className="ml-auto" onClick={goNext} disabled={loading}>
              {loading ? "Planning…" : "Next question"} <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {disagreeOpen && flow.phase === "done" && (
          <div className="paper-card space-y-3 p-4">
            <label htmlFor="disagree" className="font-serif text-xl">
              What was your approach?
            </label>
            <Textarea
              id="disagree"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I knew discounts multiply, I just misread 10% as 20%…"
              className="font-hand text-xl"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  flow.disagree(note);
                  setDisagreeOpen(false);
                }}
                disabled={note.trim().length < 5}
              >
                Re-check with my explanation
              </Button>
              <Button variant="ghost" onClick={() => setDisagreeOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <TraceDock steps={trace} running={flow.phase === "grading" || flow.phase === "diagnosing" || loading} />
    </div>
  );
}
