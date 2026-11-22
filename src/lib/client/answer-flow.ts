"use client";

import { useCallback, useRef, useState } from "react";
import type {
  DetectiveEvent,
  Diagnosis,
  PublicQuestion,
  SubmitRequest,
  SubmitResponse,
  TraceStep,
  WorkLine,
  WorkPayload,
} from "@/lib/api-types";

export type FlowPhase = "answering" | "grading" | "diagnosing" | "confirm" | "done";

/** Reads an NDJSON stream line by line. */
export async function readNdjson(res: Response, onEvent: (e: DetectiveEvent) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch {}
      }
    }
  }
  if (buf.trim()) {
    try {
      onEvent(JSON.parse(buf));
    } catch {}
  }
}

/**
 * Submit → instant verdict → (streamed) detective diagnosis.
 * Shared by /practice and /diagnostic.
 */
export function useAnswerFlow(opts: { onTrace?: (s: TraceStep) => void; quick?: boolean } = {}) {
  const [phase, setPhase] = useState<FlowPhase>("answering");
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [lines, setLines] = useState<WorkLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const workRef = useRef<WorkPayload | undefined>(undefined);
  const onTrace = opts.onTrace;

  const reset = useCallback(() => {
    setPhase("answering");
    setResult(null);
    setDiagnosis(null);
    setLines([]);
    setError(null);
    workRef.current = undefined;
  }, []);

  const runDetective = useCallback(
    async (attemptId: string, extra: { confirmedLines?: WorkLine[]; studentNote?: string } = {}) => {
      setPhase("diagnosing");
      setError(null);
      try {
        const res = await fetch("/api/detective", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptId, work: workRef.current, quick: opts.quick, ...extra }),
        });
        if (!res.ok) throw new Error(`detective ${res.status}`);
        let paused = false;
        let got = false;
        await readNdjson(res, (e) => {
          if (e.type === "step") onTrace?.(e.step);
          else if (e.type === "transcription") {
            setLines(e.lines);
            paused = true;
          } else if (e.type === "diagnosis") {
            got = true;
            setLines(e.lines);
            setDiagnosis(e.diagnosis);
          } else if (e.type === "error") setError(e.message);
        });
        setPhase(paused && !got ? "confirm" : "done");
      } catch {
        setError("The detective couldn't run this time. Your answer is still graded and saved.");
        setPhase("done");
      }
    },
    [onTrace, opts.quick],
  );

  const submit = useCallback(
    async (q: PublicQuestion, body: Omit<SubmitRequest, "questionId">) => {
      setPhase("grading");
      setError(null);
      workRef.current = body.work;
      try {
        const res = await fetch("/api/attempt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, questionId: q.id }),
        });
        if (!res.ok) throw new Error(`attempt ${res.status}`);
        const data: SubmitResponse = await res.json();
        setResult(data);
        data.trace.forEach((s) => onTrace?.(s));
        if (data.needsDiagnosis) await runDetective(data.attemptId);
        else setPhase("done");
        return data;
      } catch {
        setError("Couldn't submit. Check your connection and try again.");
        setPhase("answering");
        return null;
      }
    },
    [onTrace, runDetective],
  );

  const confirmLines = useCallback(
    (confirmed: WorkLine[]) => {
      if (result) void runDetective(result.attemptId, { confirmedLines: confirmed });
    },
    [result, runDetective],
  );

  const disagree = useCallback(
    (note: string) => {
      if (!result) return;
      setDiagnosis(null);
      void runDetective(result.attemptId, { studentNote: note, confirmedLines: lines.length ? lines : undefined });
    },
    [result, lines, runDetective],
  );

  return { phase, result, diagnosis, lines, error, submit, confirmLines, disagree, reset };
}
