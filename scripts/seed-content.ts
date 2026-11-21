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
const REJ = "data/questions-rejections.json";
const CONCURRENCY = 4;

type Band = "easy" | "medium" | "hard";
interface Spec {
  spec: string;
  conceptId: string;
  band: Band;
  type: "MCQ" | "TITA";
  contrastIndex: number | null; // index into the concept's misconceptions
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
];

// Arithmetic is the depth focus (36 of 60); weight-3 algebra/geometry get 2; the rest 1.
const PLAN: Record<string, number[]> = {
  A1: [0, 1, 2, 3, 4], A2: [0, 1, 2, 3], A3: [0, 1, 2, 3, 4], A4: [0, 1, 2, 3, 4],
  A5: [0, 1, 2, 3], A6: [0, 1, 2, 3], A7: [0, 1, 2, 3], A8: [0, 1, 2, 3, 4],
  L3: [1, 2], L4: [1, 2], L5: [1, 2], L6: [1, 2], G2: [1, 2],
  N1: [1], N2: [1], N3: [1], L1: [1], L2: [1], L7: [1], G1: [1], G3: [1], G4: [1], G5: [1], G6: [1], M1: [1], M2: [1], M3: [1],
};

function buildSpecs(): Spec[] {
  return Object.entries(PLAN).flatMap(([conceptId, slots]) =>
    slots.map((slot) => ({ spec: `${conceptId}-${slot}`, conceptId, ...PATTERN[slot] })),
  );
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
  const specs = buildSpecs().filter((s) => !done.has(s.spec));
  console.log(`${specs.length} specs to generate (${bank.length} already in bank)`);
  let ok = 0, failed = 0;

  await pool(specs, CONCURRENCY, async (s) => {
    const mcs = misconceptionsFor(s.conceptId);
    const target = s.contrastIndex != null && mcs.length ? mcs[s.contrastIndex % mcs.length] : null;
    const avoidStems = bank.filter((q) => q.concept_id === s.conceptId).map((q) => q.stem);
    const r = await generateVerified({
      conceptId: s.conceptId, targetElo: BAND_ELO[s.band], type: s.type, targetMisconceptionId: target?.id ?? null, avoidStems,
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
