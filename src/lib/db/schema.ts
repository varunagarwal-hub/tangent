/**
 * Tangent database schema (Neon Postgres via Drizzle).
 * Push with `npm run db:push`. Accessed only from server code, so no RLS.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  uuid,
  timestamp,
  date,
  index,
  primaryKey,
  unique,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const concepts = pgTable("concepts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  area: text("area").notNull(),
  prerequisites: text("prerequisites").array().notNull().default(sql`'{}'::text[]`),
  targetTimeSec: integer("target_time_sec").notNull().default(120),
  weight: integer("weight").notNull().default(2),
});

export const misconceptions = pgTable(
  "misconceptions",
  {
    id: text("id").primaryKey(),
    conceptId: text("concept_id").notNull().references(() => concepts.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    wrongReasoningExample: text("wrong_reasoning_example"),
    telltaleSigns: text("telltale_signs").array().notNull().default(sql`'{}'::text[]`),
    contrastQuestionIdea: text("contrast_question_idea"),
  },
  (t) => [index("misconceptions_concept_idx").on(t.conceptId)],
);

export type DistractorTag = { option: string; misconception_id: string };

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conceptId: text("concept_id").notNull().references(() => concepts.id),
    type: text("type", { enum: ["MCQ", "TITA"] }).notNull(),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<string[] | null>(),
    answer: text("answer").notNull(),
    solution: text("solution").notNull(),
    difficultyElo: doublePrecision("difficulty_elo").notNull().default(1200),
    attemptsCount: integer("attempts_count").notNull().default(0),
    source: text("source", { enum: ["bank", "generated"] }).notNull().default("bank"),
    verified: boolean("verified").notNull().default(false),
    targetsMisconceptionId: text("targets_misconception_id").references(() => misconceptions.id),
    distractorMisconceptions: jsonb("distractor_misconceptions").$type<DistractorTag[] | null>(),
    flagCount: integer("flag_count").notNull().default(0),
    status: text("status", { enum: ["active", "retired"] }).notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("questions_pick_idx").on(t.conceptId, t.status, t.difficultyElo),
    check("questions_type_chk", sql`${t.type} in ('MCQ','TITA')`),
  ],
);

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  teacherId: uuid("teacher_id").references((): AnyPgColumn => students.id, { onDelete: "set null" }),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: text("role", { enum: ["student", "teacher"] }).notNull().default("student"),
    classId: uuid("class_id").references((): AnyPgColumn => classes.id),
    targetPercentile: integer("target_percentile"),
    examDate: date("exam_date"),
    dailyMinutes: integer("daily_minutes").default(60),
    persona: jsonb("persona").$type<Record<string, unknown> | null>(),
    isSynthetic: boolean("is_synthetic").notNull().default(false),
    streakDays: integer("streak_days").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("students_class_idx").on(t.classId)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    conceptId: text("concept_id").notNull().references(() => concepts.id),
    answer: text("answer"),
    isCorrect: boolean("is_correct").notNull(),
    timeSec: integer("time_sec"),
    confidence: integer("confidence"), // 1–3
    workText: text("work_text"),
    workImageUrl: text("work_image_url"),
    transcription: text("transcription"),
    reasoningVerdict: text("reasoning_verdict", { enum: ["sound", "flawed", "unknown"] }).notNull().default("unknown"),
    misconceptionId: text("misconception_id"),
    errorLine: text("error_line"),
    diagnosis: jsonb("diagnosis"),
    agentTrace: jsonb("agent_trace"),
    mode: text("mode", { enum: ["diagnostic", "practice", "review", "contrast"] }).notNull().default("practice"),
    createdAt: createdAt(),
  },
  (t) => [
    index("attempts_student_time_idx").on(t.studentId, t.createdAt.desc()),
    index("attempts_concept_idx").on(t.conceptId),
    index("attempts_misconception_idx").on(t.misconceptionId),
    check("attempts_confidence_chk", sql`${t.confidence} is null or ${t.confidence} between 1 and 3`),
  ],
);

export const mastery = pgTable(
  "mastery",
  {
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    conceptId: text("concept_id").notNull().references(() => concepts.id),
    pMastery: doublePrecision("p_mastery").notNull().default(0.3),
    elo: doublePrecision("elo").notNull().default(1200),
    avgTimeRatio: doublePrecision("avg_time_ratio").notNull().default(1),
    calibration: doublePrecision("calibration").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    /** [{t, p}] for mastery-over-time charts */
    history: jsonb("history").$type<{ t: string; p: number }[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.conceptId] })],
);

export const misconceptionEvents = pgTable(
  "misconception_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    misconceptionId: text("misconception_id").notNull().references(() => misconceptions.id),
    status: text("status", { enum: ["detected", "fixing", "resolved"] }).notNull().default("detected"),
    evidenceCount: integer("evidence_count").notNull().default(1),
    cleanCount: integer("clean_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("misconception_events_student_mc_uq").on(t.studentId, t.misconceptionId)],
);

export const reviewCards = pgTable(
  "review_cards",
  {
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: ["concept", "misconception"] }).notNull(),
    itemId: text("item_id").notNull(),
    fsrsState: jsonb("fsrs_state").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.itemType, t.itemId] }),
    index("review_cards_due_idx").on(t.studentId, t.dueAt),
  ],
);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "cascade" }),
  byRole: text("by_role", { enum: ["student", "teacher"] }).notNull(),
  kind: text("kind", { enum: ["disagree_diagnosis", "bad_question", "teacher_relabel"] }).notNull(),
  note: text("note"),
  correctedMisconceptionId: text("corrected_misconception_id"),
  createdAt: createdAt(),
});

export const fewshotExamples = pgTable(
  "fewshot_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    misconceptionId: text("misconception_id").notNull().references(() => misconceptions.id),
    workText: text("work_text").notNull(),
    source: text("source", { enum: ["teacher", "seed"] }).notNull().default("seed"),
    createdAt: createdAt(),
  },
  (t) => [index("fewshot_mc_source_idx").on(t.misconceptionId, t.source)],
);

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  conceptId: text("concept_id").notNull().references(() => concepts.id),
  questionIds: uuid("question_ids").array().notNull().default(sql`'{}'::uuid[]`),
  baselineMastery: doublePrecision("baseline_mastery"),
  createdAt: createdAt(),
});

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: text("agent").notNull(),
    studentId: uuid("student_id"),
    inputSummary: text("input_summary"),
    output: jsonb("output"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull().default("ok"),
    createdAt: createdAt(),
  },
  (t) => [index("agent_runs_time_idx").on(t.createdAt.desc()), index("agent_runs_agent_idx").on(t.agent)],
);

export type Concept = typeof concepts.$inferSelect;
export type Misconception = typeof misconceptions.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Student = typeof students.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Mastery = typeof mastery.$inferSelect;
export type MisconceptionEvent = typeof misconceptionEvents.$inferSelect;
export type ReviewCard = typeof reviewCards.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;

/** A student's question to their teacher (typed or voice), optionally about a specific question/attempt. */
export const studentQueries = pgTable(
  "student_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id),
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "set null" }),
    conceptId: text("concept_id"),
    text: text("text").notNull(),
    audioUrl: text("audio_url"),
    viaVoice: boolean("via_voice").notNull().default(false),
    status: text("status", { enum: ["open", "answered"] }).notNull().default("open"),
    replyText: text("reply_text"),
    replyAudioUrl: text("reply_audio_url"),
    replyViaVoice: boolean("reply_via_voice").notNull().default(false),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("student_queries_student_idx").on(t.studentId, t.createdAt), index("student_queries_class_idx").on(t.classId, t.status, t.createdAt)],
);

/** Scores for the mini-games (Spot the Tangent, CAT speed sprint). Per-round details in `details`. */
export const gameScores = pgTable(
  "game_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    game: text("game", { enum: ["spot", "sprint"] }).notNull(),
    score: integer("score").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("game_scores_student_idx").on(t.studentId, t.game, t.createdAt)],
);
