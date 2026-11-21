/**
 * Shared client ↔ server contracts for the student loop. Safe to import anywhere.
 */
import type { TraceStep } from "@/lib/agents/trace";

export type { TraceStep };

/** A question as the client sees it — never includes the answer or solution. */
export interface PublicQuestion {
  id: string;
  conceptId: string;
  conceptName: string;
  area: string;
  type: "MCQ" | "TITA";
  /** may contain inline LaTeX in $...$ */
  stem: string;
  options: string[] | null;
  targetTimeSec: number;
  difficultyElo: number;
  source: "bank" | "generated";
}

export type Confidence = 1 | 2 | 3;

/** What the student submits. Work is optional and may be typed text and/or an image. */
export interface WorkPayload {
  /** typed working, or the confirmed transcription of an image */
  text?: string;
  /** compressed image as a data URL (scratchpad PNG / photo JPEG) */
  imageDataUrl?: string;
  /** which input tab produced it */
  source: "type" | "scratchpad" | "upload" | "sample" | "none";
}

export interface SubmitRequest {
  questionId: string;
  answer: string;
  timeSec: number;
  confidence: Confidence | null;
  mode: "diagnostic" | "practice" | "review" | "contrast";
  work?: WorkPayload;
}

/** Instant (<200ms) grading result. */
export interface SubmitResponse {
  attemptId: string;
  correct: boolean;
  correctAnswer: string;
  solution: string;
  conceptId: string;
  masteryBefore: number;
  masteryAfter: number;
  /** true when the detective should run (wrong answer, or correct with work) */
  needsDiagnosis: boolean;
  /** misconception tagged on the chosen MCQ distractor, if any (a strong hint) */
  distractorMisconceptionId: string | null;
  trace: TraceStep[];
}

/** One numbered line of the student's work (from typing or vision transcription). */
export interface WorkLine {
  n: number;
  text: string;
}

export interface Diagnosis {
  reasoningVerdict: "sound" | "flawed" | "unknown";
  misconceptionId: string | null; // null when "novel" or unsure
  misconceptionName: string | null;
  novelDescription: string | null;
  errorLineNumber: number | null;
  errorLineText: string | null;
  /** ≤ 2 sentences, mentor tone */
  explanation: string;
  confidence: number; // 0–1
  /** confidence < 0.5 → ask the student instead of guessing */
  unsure: boolean;
  /** lifecycle status after this attempt, if a misconception was involved */
  lifecycle: "detected" | "fixing" | "resolved" | null;
  fewshotFromTeachers: number;
}

/** Streamed from POST /api/detective as NDJSON, one event per line. */
export type DetectiveEvent =
  | { type: "step"; step: TraceStep }
  | { type: "transcription"; lines: WorkLine[] }
  | { type: "diagnosis"; diagnosis: Diagnosis; lines: WorkLine[] }
  | { type: "error"; message: string };

export type NextActionKind = "contrast_question" | "prerequisite_drill" | "review" | "practice" | "stretch" | "diagnostic";

export interface NextAction {
  kind: NextActionKind;
  conceptId: string;
  conceptName: string;
  misconceptionId?: string | null;
  /** one sentence: "Why this question?" */
  why: string;
  question: PublicQuestion;
  trace: TraceStep[];
}

export interface MasteryNode {
  conceptId: string;
  name: string;
  area: string;
  prerequisites: string[];
  p: number | null; // null = untested
  attempts: number;
  /** 0.35–1, fades as the concept becomes due for review */
  opacity: number;
}

export interface DiagnosticState {
  asked: { conceptId: string; correct: boolean }[];
  total: number; // 12
}

/* ── Phase 3: map, concept drawer, reveal ─────────────────────────────── */

export interface MapNode extends MasteryNode {
  weight: number;
  /** ISO due date of the concept's review card, if any */
  dueAt: string | null;
  /** FSRS retrievability now (1 = fresh) */
  retrievability: number;
  /** concept has an active (detected/fixing) misconception */
  hasActiveMisconception: boolean;
}

export interface MapData {
  nodes: MapNode[];
  edges: { from: string; to: string }[]; // prerequisite → dependent
}

export interface ConceptDetail {
  conceptId: string;
  name: string;
  area: string;
  weight: number;
  targetTimeSec: number;
  p: number | null;
  attempts: number;
  avgTimeRatio: number | null;
  history: { t: string; p: number }[];
  recentAttempts: { at: string; correct: boolean; timeSec: number | null; misconceptionName: string | null; verdict: string }[];
  misconceptions: { id: string; name: string; status: "detected" | "fixing" | "resolved"; evidenceCount: number }[];
  /** forgetting curve for the next 30 days from now: retrievability by day */
  forgetting: { day: number; r: number }[];
  dueAt: string | null;
  prerequisites: { id: string; name: string; p: number | null }[];
}

/** Stored in sessionStorage under "tangent-reveal" by /diagnostic before navigating to /reveal. */
export interface RevealPayload {
  summary?: string;
  misconceptions?: string[];
  results?: { conceptId: string; correct: boolean }[];
}
