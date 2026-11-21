import "server-only";
import { inArray, eq, and } from "drizzle-orm";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { db, schema } from "@/lib/db";
import { getConcept, getMisconception } from "@/lib/content";
import { getClassData } from "@/lib/teacher";
import type { LessonPlan, TraceStep } from "@/lib/api-types";

const PlanOutput = z.object({
  headline: z.string().describe("One sentence framing Monday's class, e.g. what the room keeps getting wrong"),
  gaps: z.array(
    z.object({
      misconception_id: z.string(),
      title: z.string().describe("Short lesson-segment title"),
      why_it_happens: z.string().describe("1–2 sentences: the intuition that leads students astray"),
      worked_example: z.object({
        problem: z.string().describe("A fresh CAT-style problem (plain text maths, no LaTeX)"),
        wrong_way: z.string().describe("The tempting wrong working, 1–3 short lines"),
        right_way: z.string().describe("The correct working, 2–4 short lines"),
      }),
      teaching_move: z.string().describe("One concrete classroom move (board work, contrast pair, quick poll…)"),
    }),
  ),
});

const SYSTEM = `You are the "Teacher Analyst" for Tangent, helping a CAT Quant coaching teacher plan Monday's class from class-wide data.
For each misconception given, write a tight lesson segment: why students fall for it, a fresh worked example (problem, the tempting wrong way, the right way), and one concrete teaching move.
Indian coaching-class context, crisp and practical. Plain text maths only (×, ÷, ^, %, ₹), never LaTeX. Check every number in your examples. Never predict percentiles.`;

let cache: { key: string; plan: LessonPlan; at: number } | null = null;

export async function buildLessonPlan(): Promise<LessonPlan> {
  const t0 = Date.now();
  const trace: TraceStep[] = [];
  const data = await getClassData();
  const top = data.leaderboard.slice(0, 3);
  trace.push({
    agent: "teacher_analyst",
    summary: `Ranked ${data.leaderboard.length} class misconceptions: top gaps ${top.map((t) => `${t.name} (${t.students})`).join(", ")}`,
    ms: Date.now() - t0,
    status: "ok",
  });

  const key = top.map((t) => `${t.misconceptionId}:${t.students}`).join("|");
  if (cache && cache.key === key && Date.now() - cache.at < 10 * 60_000) return cache.plan;

  // Deterministic groups: each student joins the group of the top gap they hold; strong students stretch.
  const active = await db
    .select({ studentId: schema.misconceptionEvents.studentId, misconceptionId: schema.misconceptionEvents.misconceptionId })
    .from(schema.misconceptionEvents)
    .where(and(inArray(schema.misconceptionEvents.misconceptionId, top.map((t) => t.misconceptionId)), inArray(schema.misconceptionEvents.status, ["detected", "fixing"])));
  const nameById = new Map(data.students.map((s) => [s.id, s.name]));
  const assigned = new Set<string>();
  const groups: LessonPlan["groups"] = top.map((t) => {
    const names = active
      .filter((a) => a.misconceptionId === t.misconceptionId && !assigned.has(a.studentId))
      .map((a) => {
        assigned.add(a.studentId);
        return nameById.get(a.studentId) ?? "";
      })
      .filter(Boolean);
    return { label: t.name, focus: `${t.conceptName}: contrast pairs and the worked example below`, students: names };
  });
  const stretch = data.students.filter((s) => !assigned.has(s.id) && (s.avgMastery ?? 0) >= 0.6).map((s) => s.name);
  if (stretch.length) groups.push({ label: "Ready to stretch", focus: "Hard mixed arithmetic at CAT speed", students: stretch });
  trace.push({ agent: "teacher_analyst", summary: `Grouped ${assigned.size + stretch.length} students by their dominant gap`, ms: Date.now() - t0, status: "ok" });

  // Deterministic question set: bank questions built around those misconceptions.
  const qs = await db
    .select()
    .from(schema.questions)
    .where(and(inArray(schema.questions.conceptId, [...new Set(top.map((t) => t.conceptId))]), eq(schema.questions.status, "active")));
  const score = (q: (typeof qs)[number]) =>
    (top.some((t) => t.misconceptionId === q.targetsMisconceptionId) ? 2 : 0) +
    ((q.distractorMisconceptions ?? []).some((d) => top.some((t) => t.misconceptionId === d.misconception_id)) ? 1 : 0);
  const questionSet = qs
    .sort((a, b) => score(b) - score(a))
    .slice(0, 10)
    .map((q) => ({ id: q.id, conceptId: q.conceptId, stem: q.stem }));
  trace.push({ agent: "teacher_analyst", summary: `Picked ${questionSet.length} bank questions whose traps match these gaps`, ms: Date.now() - t0, status: "ok" });

  // AI writes the language: why, worked examples, teaching moves.
  const t1 = Date.now();
  const prompt = [
    `Class: ${data.class.name}, ${data.kpis.students} students, average mastery ${Math.round((data.kpis.avgMastery ?? 0) * 100)}%.`,
    `Top misconceptions (students with it active / class size):`,
    ...top.map((t) => {
      const m = getMisconception(t.misconceptionId)!;
      return `- ${t.misconceptionId} (${t.conceptName}): "${m.name}". ${m.description} ${t.students}/${data.kpis.students} students. Typical wrong work:\n${m.wrong_reasoning_example}`;
    }),
    `Write one gap per misconception, in the same order, using the same misconception_id.`,
  ].join("\n");

  let ai: z.infer<typeof PlanOutput> | null = null;
  try {
    const r = await generateStructured({
      agent: "teacher_analyst",
      tier: "smart",
      system: SYSTEM,
      prompt,
      schema: PlanOutput,
      inputSummary: `lesson plan: ${top.map((t) => t.misconceptionId).join(", ")}`,
      thinking: "LOW",
      timeoutMs: 50_000,
      temperature: 0.5,
    });
    ai = r.data;
    trace.push({ agent: "teacher_analyst", summary: "Wrote worked examples and teaching moves (Gemini Pro)", ms: Date.now() - t1, status: "ok" });
  } catch {
    trace.push({ agent: "teacher_analyst", summary: "AI was slow: used the misconception library's own examples", ms: Date.now() - t1, status: "fallback" });
  }

  const plan: LessonPlan = {
    headline:
      ai?.headline ??
      `${top[0]?.students ?? 0} of ${data.kpis.students} students are adding successive changes instead of multiplying: start Monday there.`,
    gaps: top.map((t) => {
      const m = getMisconception(t.misconceptionId)!;
      const g = ai?.gaps.find((x) => x.misconception_id === t.misconceptionId);
      return {
        conceptId: t.conceptId,
        conceptName: getConcept(t.conceptId).name,
        misconceptionId: t.misconceptionId,
        misconceptionName: m.name,
        studentsAffected: t.students,
        title: g?.title ?? m.name,
        whyItHappens: g?.why_it_happens ?? m.description,
        workedExample: {
          problem: g?.worked_example.problem ?? m.contrast_question_idea,
          wrongWay: g?.worked_example.wrong_way ?? m.wrong_reasoning_example,
          rightWay: g?.worked_example.right_way ?? "Work it through on the board with the class.",
        },
        teachingMove: g?.teaching_move ?? `Contrast pair: ${m.contrast_question_idea}`,
      };
    }),
    groups,
    questionSet,
    generatedAt: new Date().toISOString(),
    trace,
  };
  cache = { key, plan, at: Date.now() };
  return plan;
}
