import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getConcept } from "@/lib/content";
import { masteryMap } from "@/lib/repo";
import foundationsData from "../../data/foundations.json";
import questionsData from "../../data/foundation-questions.json";

const s = schema;

export interface FoundationSkill { id: string; name: string; description: string; prerequisites: string[]; unlocks: string[] }
interface FoundationQuestion { id: string; skillId: string; stem: string; options: string[]; answerIndex: number; explanation: string }
export type PublicFoundationQuestion = Omit<FoundationQuestion, "answerIndex" | "explanation">;
export type FoundationState = "solid" | "shaky" | "repaired" | "unchecked";

export const FOUNDATIONS = foundationsData as FoundationSkill[];
const QUESTIONS = questionsData as FoundationQuestion[];
const Q_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export const CHECK_SIZE = 12;
export const REPAIR_SIZE = 5;
export const REPAIR_PASS = 4;
/** Skills that unlock the most of the syllabus get a second question in the check. */
const DOUBLE = ["F1", "F2", "F5", "F6"];

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
/**
 * The generator tends to put the right answer first, so every question is shown with its options in a
 * fixed shuffled order derived from its id (stable across serve and grading, no data rewrite needed).
 */
function perm(id: string): number[] {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    const j = h % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
const toPublic = ({ id, skillId, stem, options }: FoundationQuestion): PublicFoundationQuestion => ({ id, skillId, stem, options: perm(id).map((k) => options[k]) });

/** 12 questions: one per skill, two for the four that unlock the most. Grouped by skill, easiest skills first. */
export function buildCheck(): PublicFoundationQuestion[] {
  return FOUNDATIONS.flatMap((f) => shuffle(QUESTIONS.filter((q) => q.skillId === f.id)).slice(0, DOUBLE.includes(f.id) ? 2 : 1)).map(toPublic);
}

export function buildRepair(skillId: string): PublicFoundationQuestion[] {
  return shuffle(QUESTIONS.filter((q) => q.skillId === skillId)).slice(0, REPAIR_SIZE).map(toPublic);
}

export interface Graded { id: string; skillId: string; correct: boolean; choice: number | null; answerIndex: number; explanation: string }

function grade(answers: { id: string; choice: number | null }[]): Graded[] {
  return answers
    .filter((a) => Q_BY_ID.has(a.id))
    .map((a) => {
      const q = Q_BY_ID.get(a.id)!;
      const p = perm(q.id); // a.choice is a position in the shuffled order
      const shownAnswer = p.indexOf(q.answerIndex);
      return { id: q.id, skillId: q.skillId, correct: a.choice === shownAnswer, choice: a.choice, answerIndex: shownAnswer, explanation: q.explanation };
    });
}

async function upsert(studentId: string, skillId: string, status: "solid" | "shaky" | "repaired", extra: { checkCorrect?: number; checkTotal?: number; repair?: boolean }) {
  await db
    .insert(s.foundationStatus)
    .values({ studentId, skillId, status, checkCorrect: extra.checkCorrect ?? 0, checkTotal: extra.checkTotal ?? 0, repairAttempts: extra.repair ? 1 : 0 })
    .onConflictDoUpdate({
      target: [s.foundationStatus.studentId, s.foundationStatus.skillId],
      set: {
        status,
        ...(extra.checkTotal != null ? { checkCorrect: extra.checkCorrect ?? 0, checkTotal: extra.checkTotal } : {}),
        ...(extra.repair ? { repairAttempts: sql`${s.foundationStatus.repairAttempts} + 1` } : {}),
        updatedAt: new Date(),
      },
    });
}

/** A skill is solid only if every check question on it was right. */
export async function saveCheck(studentId: string, answers: { id: string; choice: number | null }[]) {
  const graded = grade(answers).slice(0, CHECK_SIZE);
  const bySkill = new Map<string, { correct: number; total: number }>();
  for (const g of graded) {
    const b = bySkill.get(g.skillId) ?? { correct: 0, total: 0 };
    b.total++;
    if (g.correct) b.correct++;
    bySkill.set(g.skillId, b);
  }
  for (const [skillId, b] of bySkill) await upsert(studentId, skillId, b.correct === b.total ? "solid" : "shaky", { checkCorrect: b.correct, checkTotal: b.total });
  return { graded, skills: [...bySkill].map(([skillId, b]) => ({ skillId, ...b, status: b.correct === b.total ? "solid" : "shaky" })) };
}

/** Repair passes at 4/5; a pass marks the skill repaired ("unlocked"). */
export async function saveRepair(studentId: string, skillId: string, answers: { id: string; choice: number | null }[]) {
  const graded = grade(answers).filter((g) => g.skillId === skillId).slice(0, REPAIR_SIZE);
  const correct = graded.filter((g) => g.correct).length;
  const passed = graded.length >= REPAIR_SIZE && correct >= REPAIR_PASS;
  const [current] = await db
    .select({ status: s.foundationStatus.status })
    .from(s.foundationStatus)
    .where(and(eq(s.foundationStatus.studentId, studentId), eq(s.foundationStatus.skillId, skillId)));
  const next = passed ? "repaired" : current?.status === "solid" || current?.status === "repaired" ? current.status : "shaky";
  await upsert(studentId, skillId, next, { repair: true });
  return { graded, correct, total: graded.length, passed };
}

/** Overview: each skill's state, what it unlocks, and which unlocked concepts are stuck (< 40%). */
export async function getFoundation(studentId: string) {
  const [rows, mastery] = await Promise.all([
    db.select().from(s.foundationStatus).where(eq(s.foundationStatus.studentId, studentId)),
    masteryMap(studentId),
  ]);
  const byId = new Map(rows.map((r) => [r.skillId, r]));
  return {
    checked: rows.length > 0,
    skills: FOUNDATIONS.map((f) => {
      const r = byId.get(f.id);
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        state: (r?.status ?? "unchecked") as FoundationState,
        check: r && r.checkTotal ? { correct: r.checkCorrect, total: r.checkTotal } : null,
        unlocks: f.unlocks.map((c) => ({ id: c, name: getConcept(c).name, p: mastery[c] ?? null })),
        stuck: f.unlocks.filter((c) => mastery[c] != null && mastery[c] < 0.4).map((c) => getConcept(c).name),
      };
    }),
  };
}

export type FoundationOverview = Awaited<ReturnType<typeof getFoundation>>;
