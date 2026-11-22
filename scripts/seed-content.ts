/**
 * Builds the verified question bank → data/questions.json.
 *   npx tsx scripts/seed-content.ts            (resumes; skips specs already done)
 *   npx tsx scripts/seed-content.ts --fresh    (start over)
 *
 * Every question passes the independent verifier (smart model, no answer key).
 * Anchor (hand-written demo) questions are verified too. Rejections are logged to
 * data/questions-rejections.json for the verifier rejection rate on /under-the-hood.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "data/questions.json";
const CONCEPT_LIST: { id: string; area: string; weight: number }[] = JSON.parse(readFileSync("data/concepts.json", "utf8"));
const ANCHOR_COUNT: Record<string, number> = (JSON.parse(readFileSync("data/anchor-questions.json", "utf8")) as { concept_id: string }[]).reduce(
  (m, q) => ({ ...m, [q.concept_id]: (m[q.concept_id] ?? 0) + 1 }), {} as Record<string, number>);
const REJ = "data/questions-rejections.json";
const CONCURRENCY = 18;

type Band = "easy" | "medium" | "hard";
interface Spec {
  spec: string;
  conceptId: string;
  band: Band;
  type: "MCQ" | "TITA";
  contrastIndex: number | null; // index into the concept's misconceptions
  theme?: string;
}

export interface BankQuestion {
  id: string;
  spec: string;
  key?: string;
  concept_id: string;
  type: "MCQ" | "TITA";
  stem: string;
  options: string[] | null;
  answer: string;
  solution: string;
  difficulty_elo: number;
  source: "bank";
  verified: true;
  targets_misconception_id: string | null;
  distractor_misconceptions: { option: string; misconception_id: string }[];
}

// Pattern slots per question index within a concept.
const PATTERN: Omit<Spec, "spec" | "conceptId">[] = [
  { band: "easy", type: "MCQ", contrastIndex: null },
  { band: "medium", type: "MCQ", contrastIndex: 0 },
  { band: "medium", type: "TITA", contrastIndex: null },
  { band: "hard", type: "MCQ", contrastIndex: 1 },
  { band: "hard", type: "TITA", contrastIndex: 2 },
  // Phase 6 expansion (bank → ~150): more variety per concept, more contrast coverage
  { band: "easy", type: "TITA", contrastIndex: null },
  { band: "medium", type: "MCQ", contrastIndex: 3 },
  { band: "easy", type: "MCQ", contrastIndex: 2 },
  { band: "hard", type: "MCQ", contrastIndex: 0 },
];

// Arithmetic is the depth focus (64 slots); weight-3 algebra/geometry get 4; the rest 3. (~146 specs)
const PLAN: Record<string, number[]> = {
  A1: [0, 1, 2, 3, 4, 5, 6, 7, 8], A2: [0, 1, 2, 3, 5, 6, 7], A3: [0, 1, 2, 3, 4, 5, 6, 7, 8], A4: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  A5: [0, 1, 2, 3, 5, 6, 7], A6: [0, 1, 2, 3, 5, 6, 7], A7: [0, 1, 2, 3, 5, 6, 7], A8: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  L3: [0, 1, 2, 3], L4: [0, 1, 2, 3], L5: [0, 1, 2, 3], L6: [0, 1, 2, 3], G2: [0, 1, 2, 3],
  N1: [0, 1, 2], N2: [0, 1, 2], N3: [0, 1, 2], L1: [0, 1, 2], L2: [0, 1, 2], L7: [0, 1, 2], G1: [0, 1, 2], G3: [0, 1, 2], G4: [0, 1, 2], G5: [0, 1, 2], G6: [0, 1, 2], M1: [0, 1, 2], M2: [0, 1, 2], M3: [0, 1, 2],
};

// Bank → ~1,000: top every concept up to a target set by its CAT weight (3 → 50, 2 → 30, 1 → 20).
const TARGET_BY_WEIGHT: Record<number, number> = { 3: 50, 2: 30, 1: 20 };
const BAND_CYCLE: Band[] = ["easy", "medium", "medium", "hard", "medium", "easy", "hard", "medium", "hard", "easy"];
const LIFE_THEMES = [
  "salaries and pay revisions", "shopping, sales and discounts", "city population and census", "investments and savings",
  "cricket and sports scores", "train and road travel", "factory production", "farming and harvests", "exam marks and results",
  "mixing ingredients in a kitchen", "fuel and mileage", "rent and property prices", "a small business's accounts",
  "water tanks and pipes", "a school or college", "festivals and events", "online orders and delivery", "elections and votes",
];
const MATH_ANGLES = [
  "direct computation", "find the unknown value", "which of the following must be true", "count the number of solutions",
  "minimum or maximum value", "integer constraints", "a short word problem", "pattern or sequence",
  "compare two quantities", "a condition that pins down the answer",
];

function buildSpecs(): Spec[] {
  const base = Object.entries(PLAN).flatMap(([conceptId, slots]) =>
    slots.map((slot) => ({ spec: `${conceptId}-${slot}`, conceptId, ...PATTERN[slot] }) as Spec),
  );
  const extra: Spec[] = [];
  for (const c of CONCEPT_LIST) {
    const have = base.filter((b) => b.conceptId === c.id).length + (ANCHOR_COUNT[c.id] ?? 0);
    const plus = Number(process.argv.find((x) => x.startsWith("--plus="))?.slice(7) ?? 0); // top-up: raise every target by N
    const want = (TARGET_BY_WEIGHT[c.weight] ?? 20) + plus;
    const themes = c.area === "Arithmetic" || c.area === "Modern Math" ? LIFE_THEMES : MATH_ANGLES;
    for (let n = 0; n < Math.max(0, want - have); n++) {
      extra.push({
        spec: `${c.id}-x${n}`,
        conceptId: c.id,
        band: BAND_CYCLE[n % BAND_CYCLE.length],
        type: n % 3 === 2 ? "TITA" : "MCQ",
        contrastIndex: n % 2 === 0 ? Math.floor(n / 2) : null,
        theme: themes[(n * 7 + c.id.charCodeAt(1)) % themes.length],
      });
    }
  }
  return [...base, ...extra];
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  const { generateVerified, BAND_ELO } = await import("../src/lib/agents/generator");
  const { verifyQuestion } = await import("../src/lib/agents/verifier");
  const { misconceptionsFor, getMisconception } = await import("../src/lib/content");

  const bank: BankQuestion[] = !fresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const rejections: { spec: string; reason: string }[] = !fresh && existsSync(REJ) ? JSON.parse(readFileSync(REJ, "utf8")) : [];
  const done = new Set(bank.map((q) => q.spec));
  const save = () => {
    writeFileSync(OUT, JSON.stringify(bank, null, 2) + "\n");
    writeFileSync(REJ, JSON.stringify(rejections, null, 2) + "\n");
  };

  // 1) Anchor (demo) questions — verified like everything else.
  const anchors = JSON.parse(readFileSync("data/anchor-questions.json", "utf8"));
  for (const a of anchors) {
    const spec = `anchor-${a.key}`;
    if (done.has(spec)) continue;
    if (!getMisconception(a.targets_misconception_id)) throw new Error(`${a.key}: unknown misconception ${a.targets_misconception_id}`);
    const v = await verifyQuestion({ type: a.type, stem: a.stem, options: a.options, answer: a.answer });
    if (!v.ok) {
      console.error(`✗ anchor ${a.key} REJECTED: ${v.reason} — fix data/anchor-questions.json`);
      rejections.push({ spec, reason: v.reason });
      continue;
    }
    bank.push({
      id: randomUUID(), spec, key: a.key, concept_id: a.concept_id, type: a.type, stem: a.stem, options: a.options,
      answer: a.answer, solution: a.solution, difficulty_elo: a.difficulty_elo, source: "bank", verified: true,
      targets_misconception_id: a.targets_misconception_id, distractor_misconceptions: a.distractor_misconceptions,
    });
    console.log(`✓ anchor ${a.key}`);
    save();
  }

  // 2) Generated bank.
  if (process.argv.includes("--plan")) {
    const all = buildSpecs(); const todo = all.filter((s) => !done.has(s.spec));
    console.log(`plan: ${all.length} specs + anchors; ${todo.length} still to generate`);
    return;
  }
  const specs = buildSpecs().filter((s) => !done.has(s.spec));
  console.log(`${specs.length} specs to generate (${bank.length} already in bank)`);
  let ok = 0, failed = 0;

  await pool(specs, CONCURRENCY, async (s) => {
    const mcs = misconceptionsFor(s.conceptId);
    const target = s.contrastIndex != null && mcs.length ? mcs[s.contrastIndex % mcs.length] : null;
    const avoidStems = bank.filter((q) => q.concept_id === s.conceptId).map((q) => q.stem);
    const r = await generateVerified({
      conceptId: s.conceptId, targetElo: BAND_ELO[s.band], type: s.type, targetMisconceptionId: target?.id ?? null, avoidStems, theme: s.theme,
    });
    for (const reason of r.rejections) rejections.push({ spec: s.spec, reason });
    if (!r.question) {
      failed++;
      console.log(`✗ ${s.spec} — all drafts rejected (${r.rejections.join("; ").slice(0, 160)})`);
      save();
      return;
    }
    const q = r.question;
    bank.push({
      id: randomUUID(), spec: s.spec, concept_id: q.conceptId, type: q.type, stem: q.stem,
      options: q.type === "MCQ" ? q.options : null, answer: q.answer, solution: q.solution,
      difficulty_elo: BAND_ELO[s.band], source: "bank", verified: true,
      targets_misconception_id: q.targetsMisconceptionId, distractor_misconceptions: q.distractorMisconceptions,
    });
    ok++;
    console.log(`✓ ${s.spec} ${q.type} ${s.band}${target ? ` → ${target.id}` : ""}${r.rejections.length ? ` (after ${r.rejections.length} rejection)` : ""}`);
    save();
  });

  bank.sort((a, b) => a.spec.localeCompare(b.spec));
  save();
  const total = bank.length + rejections.length;
  console.log(`\nDone: +${ok} new, ${failed} failed. Bank = ${bank.length}. Rejections logged = ${rejections.length} (rejection rate ≈ ${((rejections.length / Math.max(1, total)) * 100).toFixed(0)}%).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
