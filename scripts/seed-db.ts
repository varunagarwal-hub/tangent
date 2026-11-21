/**
 * Loads content into Neon and simulates the demo class through the REAL learner model.
 *   npx tsx scripts/seed-db.ts
 * Idempotent: wipes all tables first. Deterministic (seeded RNG).
 *
 * Creates: class "CAT 2027 Batch A", Prof. Mehta, Riya (scripted demo history) and
 * 30 synthetic students with personas. "Averaging averages" and "successive
 * percentages" are planted as class-wide gaps.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { StoredCard } from "../src/lib/learner/fsrs";

// ── deterministic RNG ────────────────────────────────────────────────────────
let seed = 20261121;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);
function weightedPick<T>(items: T[], w: (t: T) => number): T {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = rand() * total;
  for (const x of items) if ((r -= w(x)) <= 0) return x;
  return items[items.length - 1];
}

// ── personas ────────────────────────────────────────────────────────────────
type Area = "Arithmetic" | "Number System" | "Algebra" | "Geometry" | "Modern Math";
interface Archetype {
  label: string;
  area: Partial<Record<Area, number>>; // skill offset (elo points)
  speed: number; // time multiplier (1 = on target)
  careless: number; // chance to slip on a question they "know"
  overconfident: boolean;
}
const ARCHETYPES: Archetype[] = [
  { label: "Strong in algebra, weak in arithmetic", area: { Algebra: 180, Arithmetic: -160 }, speed: 1.0, careless: 0.05, overconfident: false },
  { label: "Careless but fast", area: {}, speed: 0.65, careless: 0.22, overconfident: true },
  { label: "Slow but accurate", area: { Arithmetic: 60, Algebra: 60 }, speed: 1.6, careless: 0.02, overconfident: false },
  { label: "Overconfident", area: { Geometry: -80 }, speed: 0.9, careless: 0.08, overconfident: true },
  { label: "All-rounder", area: { Arithmetic: 80, Algebra: 80, Geometry: 60, "Number System": 60 }, speed: 0.95, careless: 0.05, overconfident: false },
  { label: "Geometry-averse", area: { Geometry: -200, "Modern Math": -60, Arithmetic: 40 }, speed: 1.1, careless: 0.06, overconfident: false },
];

const NAMES = [
  "Aarav Mehra", "Ananya Iyer", "Vihaan Gupta", "Ishita Rao", "Kabir Singh", "Diya Nair", "Arjun Reddy", "Sneha Kulkarni",
  "Rohan Das", "Meera Pillai", "Aditya Joshi", "Kavya Menon", "Siddharth Bose", "Tanvi Shah", "Nikhil Verma", "Pooja Hegde",
  "Rahul Chatterjee", "Aditi Banerjee", "Karan Malhotra", "Nisha Agarwal", "Varun Sethi", "Riddhi Desai", "Manav Kapoor", "Shreya Ghosh",
  "Yash Thakur", "Neha Saxena", "Harsh Vardhan", "Priya Krishnan", "Aman Tiwari", "Zoya Qureshi",
];

// Class-wide gaps (the heatmap story).
const CLASS_GAPS: { id: string; prevalence: number }[] = [
  { id: "A3_AVG_OF_AVGS", prevalence: 0.6 },
  { id: "A1_ADD_SUCCESSIVE", prevalence: 0.55 },
  { id: "A8_MEAN_OF_SPEEDS", prevalence: 0.35 },
];

async function main() {
  const { getDb } = await import("../src/lib/db/client");
  const s = await import("../src/lib/db/schema");
  const L = await import("../src/lib/learner");
  const { CONCEPTS, MISCONCEPTIONS, getConcept, misconceptionsFor } = await import("../src/lib/content");
  const { RIYA_ID, MEHTA_ID, CLASS_ID } = await import("../src/lib/personas");
  const db = getDb();

  const questions: Array<{
    id: string; concept_id: string; type: "MCQ" | "TITA"; stem: string; options: string[] | null; answer: string; solution: string;
    difficulty_elo: number; targets_misconception_id: string | null; distractor_misconceptions: { option: string; misconception_id: string }[];
  }> = JSON.parse(readFileSync("data/questions.json", "utf8"));
  const fewshot: { misconception_id: string; work_text: string; question?: string }[] = existsSync("data/fewshot-seed.json")
    ? JSON.parse(readFileSync("data/fewshot-seed.json", "utf8")) : [];
  const fewshotByMc = new Map(fewshot.map((f) => [f.misconception_id, f.work_text]));
  const fewshotQuestionByMc = new Map(fewshot.map((f) => [f.misconception_id, f.question ?? null]));
  const qByConcept = new Map<string, typeof questions>();
  for (const q of questions) qByConcept.set(q.concept_id, [...(qByConcept.get(q.concept_id) ?? []), q]);
  const mcIds = new Set(MISCONCEPTIONS.map((m) => m.id));

  // ── wipe ──
  console.log("Wiping tables…");
  await db.execute(sql`truncate agent_runs, assignments, fewshot_examples, feedback, review_cards, misconception_events,
    mastery, attempts, students, classes, questions, misconceptions, concepts restart identity cascade`);

  // ── content ──
  await db.insert(s.concepts).values(CONCEPTS.map((c) => ({
    id: c.id, name: c.name, area: c.area, prerequisites: c.prerequisites, targetTimeSec: c.target_time_sec, weight: c.weight,
  })));
  await db.insert(s.misconceptions).values(MISCONCEPTIONS.map((m) => ({
    id: m.id, conceptId: m.concept_id, name: m.name, description: m.description, wrongReasoningExample: m.wrong_reasoning_example,
    telltaleSigns: m.telltale_signs, contrastQuestionIdea: m.contrast_question_idea,
  })));
  // Questions first (attempts reference them); their Elo is recalibrated after the simulation.
  for (let i = 0; i < questions.length; i += 100) {
    await db.insert(s.questions).values(questions.slice(i, i + 100).map((q) => ({
      id: q.id, conceptId: q.concept_id, type: q.type, stem: q.stem, options: q.options, answer: q.answer, solution: q.solution,
      difficultyElo: q.difficulty_elo, attemptsCount: 0, source: "bank" as const, verified: true,
      targetsMisconceptionId: q.targets_misconception_id && mcIds.has(q.targets_misconception_id) ? q.targets_misconception_id : null,
      distractorMisconceptions: q.distractor_misconceptions,
    })));
  }
  // question elo is mutated by the simulation; keep a live map
  const qElo = new Map(questions.map((q) => [q.id, q.difficulty_elo]));
  const qAttempts = new Map(questions.map((q) => [q.id, 0]));
  if (fewshot.length) {
    await db.insert(s.fewshotExamples).values(fewshot.filter((f) => mcIds.has(f.misconception_id)).map((f) => ({
      misconceptionId: f.misconception_id, workText: f.work_text, source: "seed" as const,
    })));
  }
  console.log(`Loaded ${CONCEPTS.length} concepts, ${MISCONCEPTIONS.length} misconceptions, ${questions.length} questions, ${fewshot.length} few-shot examples.`);

  // ── class + people ──
  await db.insert(s.students).values({ id: MEHTA_ID, name: "Prof. Mehta", role: "teacher", isSynthetic: false });
  await db.insert(s.classes).values({ id: CLASS_ID, name: "CAT 2027 Batch A", teacherId: MEHTA_ID });
  await db.update(s.students).set({ classId: CLASS_ID }).where(sql`id = ${MEHTA_ID}`);

  const now = new Date();
  const DAY = 86_400_000;
  const examDate = "2027-11-28";

  const attemptRows: (typeof s.attempts.$inferInsert)[] = [];
  const masteryRows: (typeof s.mastery.$inferInsert)[] = [];
  const cardRows: (typeof s.reviewCards.$inferInsert)[] = [];
  const eventRows: (typeof s.misconceptionEvents.$inferInsert)[] = [];

  /** Simulate one student through the real learner model. */
  function simulate(opts: {
    id: string;
    skill: (conceptId: string) => number; // true skill (elo scale)
    holds: Set<string>; // misconceptions this student actually holds
    speed: number;
    careless: number;
    overconfident: boolean;
    sessions: Date[]; // session start times
    perSession: () => number;
    conceptWeight: (conceptId: string) => number;
    resolveChance: number;
    randomMisattribution?: number; // chance a wrong answer is pinned on a misconception the student does not hold
    skillBoost?: (conceptId: string, t: Date) => number;
  }) {
    const state = new Map<string, ReturnType<typeof L.initialConceptState>>();
    const history = new Map<string, { t: string; p: number }[]>();
    const lastSeen = new Map<string, Date>();
    const life = new Map<string, ReturnType<typeof L.stepMisconception>>();
    const lifeAt = new Map<string, Date>();
    const mcCards = new Map<string, { card: StoredCard; due: Date }>();

    const currentMastery = () => Object.fromEntries([...state].map(([k, v]) => [k, v.pMastery]));
    const getState = (cid: string) => {
      if (!state.has(cid)) {
        const prereq = getConcept(cid).prerequisites.map((p) => state.get(p)?.pMastery).filter((x): x is number => x != null);
        state.set(cid, L.initialConceptState(L.priorFromPrereqs(prereq)));
      }
      return state.get(cid)!;
    };

    for (const start of opts.sessions) {
      let t = start.getTime();
      const n = opts.perSession();
      for (let i = 0; i < n; i++) {
        const concept = weightedPick(CONCEPTS.filter((c) => qByConcept.has(c.id)), (c) => opts.conceptWeight(c.id));
        const st = getState(concept.id);
        const q = L.pickByDifficulty(st.elo, (qByConcept.get(concept.id) ?? []).map((x) => ({ ...x, difficultyElo: qElo.get(x.id)! })))!;
        const when = new Date(t);

        // P(correct) from true skill vs question difficulty, hurt by held misconceptions
        const heldHere = [...opts.holds].filter((m) => m.startsWith(concept.id + "_") && life.get(m)?.status !== "resolved");
        const skill = opts.skill(concept.id) + (opts.skillBoost?.(concept.id, when) ?? 0) + st.attempts * 3;
        let p = L.expectedCorrect(skill, qElo.get(q.id)!);
        if (heldHere.length) p *= q.targets_misconception_id && heldHere.includes(q.targets_misconception_id) ? 0.25 : 0.7;
        if (chance(opts.careless)) p *= 0.5;
        const correct = chance(p);

        // misconception attribution for wrong answers
        let misconceptionId: string | null = null;
        let verdict: "sound" | "flawed" | "unknown" = correct ? "sound" : "unknown";
        if (!correct) {
          const candidates = misconceptionsFor(concept.id).map((m) => m.id);
          if (heldHere.length && chance(0.8)) misconceptionId = pick(heldHere);
          else if (candidates.length && chance(opts.randomMisattribution ?? 0.35)) misconceptionId = pick(candidates);
          verdict = misconceptionId ? "flawed" : "unknown";
        } else if (heldHere.length && chance(0.12)) {
          // right answer, wrong reasoning
          misconceptionId = pick(heldHere);
          verdict = "flawed";
        }

        const timeSec = Math.round(concept.target_time_sec * opts.speed * between(0.6, 1.5) * (correct ? 1 : 1.15));
        const confidence: 1 | 2 | 3 = opts.overconfident
          ? (chance(0.75) ? 3 : 2)
          : p > 0.7 ? (chance(0.6) ? 3 : 2) : p > 0.4 ? 2 : (chance(0.6) ? 1 : 2);

        const res = L.applyAttempt(st, {
          correct, type: q.type, verdict, timeSec, targetTimeSec: concept.target_time_sec, confidence,
          questionElo: qElo.get(q.id)!, questionAttempts: qAttempts.get(q.id)!,
        }, when);
        state.set(concept.id, res.concept);
        qElo.set(q.id, res.questionElo);
        qAttempts.set(q.id, qAttempts.get(q.id)! + 1);
        history.set(concept.id, [...(history.get(concept.id) ?? []), { t: when.toISOString(), p: +res.concept.pMastery.toFixed(4) }]);
        lastSeen.set(concept.id, when);

        // lifecycle
        if (misconceptionId) {
          life.set(misconceptionId, L.stepMisconception(life.get(misconceptionId) ?? null, { kind: "detected" }));
          lifeAt.set(misconceptionId, when);
          mcCards.set(misconceptionId, L.review(mcCards.get(misconceptionId)?.card ?? null, "Again", when));
        } else if (correct && verdict === "sound") {
          for (const m of heldHere) {
            if (!chance(opts.resolveChance)) continue;
            let cur = life.get(m) ?? null;
            if (cur && cur.status === "detected") cur = L.stepMisconception(cur, { kind: "contrast_served" });
            if (cur) {
              cur = L.stepMisconception(cur, { kind: "clean_correct" });
              life.set(m, cur);
              lifeAt.set(m, when);
              mcCards.set(m, L.review(mcCards.get(m)?.card ?? null, "Good", when));
            }
          }
        }

        const withWork = misconceptionId && fewshotByMc.has(misconceptionId) && chance(0.35);
        attemptRows.push({
          id: randomUUID(), studentId: opts.id, questionId: q.id, conceptId: concept.id,
          answer: correct ? q.answer : (q.options?.find((o) => o !== q.answer) ?? "0"),
          isCorrect: correct, timeSec, confidence,
          workText: withWork ? fewshotByMc.get(misconceptionId!)! : null,
          reasoningVerdict: verdict, misconceptionId,
          errorLine: withWork ? "see work" : null,
          diagnosis: misconceptionId
            ? { misconception_id: misconceptionId, confidence: +between(0.42, 0.96).toFixed(2), source: "seed", ...(withWork ? { workQuestion: fewshotQuestionByMc.get(misconceptionId!) } : {}) }
            : null,
          mode: "practice", createdAt: when,
        });
        t += (timeSec + between(20, 90)) * 1000;
      }
    }

    for (const [cid, st] of state) {
      masteryRows.push({
        studentId: opts.id, conceptId: cid, pMastery: st.pMastery, elo: st.elo, avgTimeRatio: st.avgTimeRatio,
        calibration: st.calibration, attempts: st.attempts, lastSeen: lastSeen.get(cid) ?? null, history: history.get(cid) ?? [],
      });
      if (st.card) cardRows.push({ studentId: opts.id, itemType: "concept", itemId: cid, fsrsState: st.card, dueAt: new Date(st.card.due) });
    }
    for (const [mid, l] of life) {
      eventRows.push({
        studentId: opts.id, misconceptionId: mid, status: l.status, evidenceCount: l.evidenceCount, cleanCount: l.cleanCount,
        createdAt: lifeAt.get(mid), updatedAt: lifeAt.get(mid),
      });
      const c = mcCards.get(mid);
      if (c && l.status !== "resolved") cardRows.push({ studentId: opts.id, itemType: "misconception", itemId: mid, fsrsState: c.card, dueAt: c.due });
    }
    return { mastery: currentMastery(), life };
  }

  const areaOf = (cid: string) => getConcept(cid).area as Area;
  const arithmeticHeavy = (cid: string) => (cid.startsWith("A") ? 3 : 1) * getConcept(cid).weight;

  // Assignment on A3 five days ago: students who did it improve on A3 afterwards.
  const assignmentAt = new Date(now.getTime() - 5 * DAY);
  const a3Questions = (qByConcept.get("A3") ?? []).map((q) => q.id).slice(0, 10);

  /** A student's mastery on a concept as of a moment, from the recorded history. */
  function masteryAt(studentId: string, conceptId: string, at: Date) {
    const row = masteryRows.find((m) => m.studentId === studentId && m.conceptId === conceptId);
    const before = (row?.history ?? []).filter((h) => new Date(h.t) <= at);
    return before.length ? before[before.length - 1].p : 0.3;
  }

  // ── 30 synthetic students ──
  const studentRows: (typeof s.students.$inferInsert)[] = [];
  const a3Baseline: number[] = [];
  for (let i = 0; i < 30; i++) {
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    const id = randomUUID();
    const base = between(1050, 1300);
    const conceptJitter = new Map(CONCEPTS.map((c) => [c.id, between(-90, 90)]));
    const holds = new Set<string>();
    for (const g of CLASS_GAPS) if (chance(g.prevalence)) holds.add(g.id);
    const extra = MISCONCEPTIONS.filter((m) => !holds.has(m.id));
    for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) holds.add(pick(extra).id);

    const days = 21;
    const sessions: Date[] = [];
    for (let d = days; d >= 1; d--) if (chance(0.55)) sessions.push(new Date(now.getTime() - d * DAY + between(8, 21) * 3600_000));
    const target = 40 + Math.floor(rand() * 41);
    const perSession = () => Math.max(2, Math.round(target / Math.max(1, sessions.length) + between(-2, 2)));

    const sim = simulate({
      id,
      skill: (cid) => base + (arch.area[areaOf(cid)] ?? 0) + conceptJitter.get(cid)!,
      holds, speed: arch.speed * between(0.9, 1.1), careless: arch.careless, overconfident: arch.overconfident,
      sessions, perSession, conceptWeight: arithmeticHeavy, resolveChance: 0.3,
      skillBoost: (cid, t) => (cid === "A3" && t > assignmentAt ? 260 : 0),
    });
    studentRows.push({
      id, name: NAMES[i], role: "student", classId: CLASS_ID, targetPercentile: pick([90, 95, 97, 99]), examDate,
      dailyMinutes: pick([45, 60, 90, 120]), persona: { archetype: arch.label, holds: [...holds] }, isSynthetic: true,
      streakDays: Math.floor(rand() * 9),
    });
    a3Baseline.push(masteryAt(id, "A3", assignmentAt));
  }

  // ── Riya: the scripted demo student ──
  {
    const riyaSkill: Record<string, number> = { A1: 1060, A4: 900, A5: 1150, A2: 1500, A3: 1450, A6: 1350, A7: 1450, A8: 1400 };
    const sessions: Date[] = [];
    for (let d = 14; d >= 1; d--) {
      // last 6 days consecutive (6-day streak), sporadic before
      if (d <= 6 || chance(0.5)) sessions.push(new Date(now.getTime() - d * DAY + between(18, 21) * 3600_000));
    }
    simulate({
      id: RIYA_ID,
      skill: (cid) => riyaSkill[cid] ?? (areaOf(cid) === "Algebra" ? 1650 : 1350),
      holds: new Set(["A1_ADD_SUCCESSIVE"]),
      speed: 1.05, careless: 0.05, overconfident: false,
      sessions, perSession: () => 4 + Math.floor(rand() * 3),
      conceptWeight: (cid) => (["A1", "A4"].includes(cid) ? 9 : ["A2", "A3"].includes(cid) ? 5 : cid.startsWith("L") ? 2 : 1),
      resolveChance: 0, randomMisattribution: 0.08,
    });
    // Guarantee the demo state: A1_ADD_SUCCESSIVE is active ("fixing"); A4_ADD_DISCOUNTS is NOT yet known
    // (the demo detects it live). Strip any simulated A4_ADD_DISCOUNTS evidence for Riya.
    for (let k = eventRows.length - 1; k >= 0; k--) {
      if (eventRows[k].studentId === RIYA_ID && eventRows[k].misconceptionId === "A4_ADD_DISCOUNTS") eventRows.splice(k, 1);
    }
    for (const a of attemptRows) if (a.studentId === RIYA_ID && a.misconceptionId === "A4_ADD_DISCOUNTS") { a.misconceptionId = null; a.reasoningVerdict = "unknown"; a.diagnosis = null; }
    for (let k = cardRows.length - 1; k >= 0; k--) {
      if (cardRows[k].studentId === RIYA_ID && cardRows[k].itemId === "A4_ADD_DISCOUNTS") cardRows.splice(k, 1);
    }
    const ev = eventRows.find((e) => e.studentId === RIYA_ID && e.misconceptionId === "A1_ADD_SUCCESSIVE");
    if (ev) { ev.status = "fixing"; ev.evidenceCount = Math.max(3, ev.evidenceCount ?? 0); ev.cleanCount = 0; }
    else eventRows.push({ studentId: RIYA_ID, misconceptionId: "A1_ADD_SUCCESSIVE", status: "fixing", evidenceCount: 3, cleanCount: 0, updatedAt: new Date(now.getTime() - DAY) });

    // "A few due reviews": keep the active misconception card + the 3 most overdue concept cards due;
    // push the rest out over the coming week (demo readability).
    const riyaCards = cardRows.filter((c) => c.studentId === RIYA_ID).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const keepDue = new Set([
      ...riyaCards.filter((c) => c.itemId === "A1_ADD_SUCCESSIVE"),
      ...riyaCards.filter((c) => c.itemType === "concept").slice(0, 3),
    ]);
    let offset = 1;
    for (const c of riyaCards) {
      if (keepDue.has(c)) {
        if (+new Date(c.dueAt) > +now) c.dueAt = new Date(now.getTime() - 3600_000);
      } else if (+new Date(c.dueAt) <= +now) {
        c.dueAt = new Date(now.getTime() + (offset++ % 6 + 1) * DAY);
      } else continue;
      c.fsrsState = { ...(c.fsrsState as StoredCard), due: new Date(c.dueAt).toISOString() };
    }

    studentRows.push({
      id: RIYA_ID, name: "Riya Sharma", role: "student", classId: CLASS_ID, targetPercentile: 99, examDate, dailyMinutes: 90,
      persona: { archetype: "Strong in algebra, shaky on percentages → profit & loss", demo: true }, isSynthetic: false, streakDays: 6,
    });
  }

  // ── write ──
  await db.insert(s.students).values(studentRows);
  const chunk = async <T,>(rows: T[], n: number, f: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += n) await f(rows.slice(i, i + n));
  };
  await chunk(attemptRows, 250, (p) => db.insert(s.attempts).values(p));
  await chunk(masteryRows, 300, (p) => db.insert(s.mastery).values(p));
  await chunk(cardRows, 300, (p) => db.insert(s.reviewCards).values(p));
  await chunk(eventRows, 300, (p) => db.insert(s.misconceptionEvents).values(p));

  // Recalibrated question Elo from the whole simulated class (one UPDATE … FROM VALUES).
  const eloValues = questions.map((q) => sql`(${q.id}::uuid, ${Math.round(qElo.get(q.id)!)}::float, ${qAttempts.get(q.id)!}::int)`);
  await db.execute(sql`update questions set difficulty_elo = v.elo, attempts_count = v.n
    from (values ${sql.join(eloValues, sql`, `)}) as v(id, elo, n) where questions.id = v.id`);

  if (a3Questions.length) {
    await db.insert(s.assignments).values({
      classId: CLASS_ID, conceptId: "A3", questionIds: a3Questions,
      baselineMastery: a3Baseline.reduce((x, y) => x + y, 0) / a3Baseline.length, createdAt: assignmentAt,
    });
  }

  const counts = await db.execute(sql`select
    (select count(*) from students)::int as students, (select count(*) from attempts)::int as attempts,
    (select count(*) from mastery)::int as mastery, (select count(*) from review_cards)::int as cards,
    (select count(*) from misconception_events)::int as events, (select count(*) from questions)::int as questions,
    (select count(*) from review_cards where student_id = ${RIYA_ID} and due_at <= now())::int as riya_due`);
  console.log("Seeded:", counts.rows[0]);

  // Snapshot Riya's freshly seeded state for the in-app "Reset demo" button (POST /api/demo/reset).
  const { snapshotRiya } = await import("./snapshot-riya");
  await snapshotRiya();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
