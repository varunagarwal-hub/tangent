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

/* ── Phase 4: teacher dashboard ───────────────────────────────────────── */

export interface TeacherStudentRow {
  id: string;
  name: string;
  archetype: string | null;
  avgMastery: number | null;
  attempts: number;
  activeMisconceptions: number;
  atRisk: boolean;
  /** why at risk, e.g. "avg mastery 31%", "4 active misconceptions", "inactive 6 days" */
  riskReasons: string[];
  lastActive: string | null;
}

export interface LeaderboardRow {
  misconceptionId: string;
  name: string;
  conceptId: string;
  conceptName: string;
  /** students with this misconception active (detected/fixing) */
  students: number;
  pctClass: number; // 0–1
  /** attempts attributed to it in the last 7 days vs the 7 days before */
  trend: { thisWeek: number; lastWeek: number };
}

export interface OverrideItem {
  attemptId: string;
  studentId: string;
  studentName: string;
  conceptId: string;
  conceptName: string;
  questionStem: string;
  studentAnswer: string | null;
  workText: string | null;
  errorLine: string | null;
  misconceptionId: string | null;
  misconceptionName: string | null;
  confidence: number | null;
  createdAt: string;
  /** misconceptions of this concept, for the relabel picker */
  candidates: { id: string; name: string }[];
}

export interface AssignmentRow {
  id: string;
  conceptId: string;
  conceptName: string;
  createdAt: string;
  questionCount: number;
  baseline: number | null; // class avg mastery when assigned
  current: number | null; // class avg mastery now
  lift: number | null; // current − baseline
}

export interface TeacherClassData {
  class: { id: string; name: string };
  kpis: { students: number; avgMastery: number | null; activeMisconceptions: number; atRisk: number };
  concepts: { id: string; name: string; area: string; weight: number }[];
  students: TeacherStudentRow[];
  /** heat[studentId][conceptId] = p_mastery (null = untested) */
  heat: Record<string, Record<string, number | null>>;
  /** class average per concept (null = nobody tested) */
  conceptAvg: Record<string, number | null>;
  leaderboard: LeaderboardRow[];
  overrideQueue: OverrideItem[];
  assignments: AssignmentRow[];
  teacherCorrections: number;
}

export interface StudentDrilldown {
  id: string;
  name: string;
  archetype: string | null;
  targetPercentile: number | null;
  streakDays: number;
  calibrationGap: number | null; // + = overconfident
  areas: { area: string; mastery: number | null }[];
  weakest: { conceptId: string; name: string; p: number }[];
  misconceptions: { id: string; name: string; status: "detected" | "fixing" | "resolved"; evidenceCount: number }[];
  recentAttempts: { at: string; conceptName: string; correct: boolean; timeSec: number | null; misconceptionName: string | null }[];
}

export interface LessonPlan {
  headline: string;
  gaps: {
    conceptId: string;
    conceptName: string;
    misconceptionId: string | null;
    misconceptionName: string | null;
    studentsAffected: number;
    title: string;
    whyItHappens: string;
    workedExample: { problem: string; wrongWay: string; rightWay: string };
    teachingMove: string;
  }[];
  groups: { label: string; focus: string; students: string[] }[];
  questionSet: { id: string; conceptId: string; stem: string }[];
  generatedAt: string;
  trace: TraceStep[];
}
