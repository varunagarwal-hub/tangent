/**
 * Add new questions from data/questions.json to the database WITHOUT wiping anything.
 *   npx tsx scripts/load-bank.ts          (dry run: counts only)
 *   npx tsx scripts/load-bank.ts --apply  (insert)
 *
 * - Skips questions whose id is already in the DB (existing ones keep their calibrated difficulty).
 * - Skips near-duplicates: same concept and ≥ 80% overlap of words and numbers (relative to the longer stem) with a question already kept.
 * Use this instead of seed-db.ts after growing the bank: seed-db wipes the DB and re-simulates the class.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync } from "node:fs";

interface BankQ {
  id: string; concept_id: string; type: "MCQ" | "TITA"; stem: string; options: string[] | null; answer: string; solution: string;
  difficulty_elo: number; targets_misconception_id: string | null; distractor_misconceptions: { option: string; misconception_id: string }[];
}

const words = (s: string) => new Set(s.toLowerCase().replace(/\$[^$]*\$/g, (m) => m.replace(/\s+/g, "")).split(/[^a-z0-9₹%.]+/).filter((w) => w.length > 2 || /^[0-9]/.test(w)));
const overlap = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.max(1, a.size, b.size);
};

async function main() {
  const apply = process.argv.includes("--apply");
  const { getDb } = await import("../src/lib/db/client");
  const schema = await import("../src/lib/db/schema");
  const db = getDb();
  const bank: BankQ[] = JSON.parse(readFileSync("data/questions.json", "utf8"));
  const existing = await db.select({ id: schema.questions.id, conceptId: schema.questions.conceptId, stem: schema.questions.stem }).from(schema.questions);
  const have = new Set(existing.map((q) => q.id));
  const kept = new Map<string, Set<string>[]>();
  for (const q of existing) kept.set(q.conceptId, [...(kept.get(q.conceptId) ?? []), words(q.stem)]);

  const toAdd: BankQ[] = [];
  let dupes = 0;
  for (const q of bank) {
    if (have.has(q.id)) continue;
    const w = words(q.stem);
    if ((kept.get(q.concept_id) ?? []).some((k) => overlap(w, k) >= 0.8)) { dupes++; continue; }
    kept.set(q.concept_id, [...(kept.get(q.concept_id) ?? []), w]);
    toAdd.push(q);
  }
  const per: Record<string, number> = {};
  for (const q of toAdd) per[q.concept_id] = (per[q.concept_id] ?? 0) + 1;
  console.log(`bank file: ${bank.length} · already in DB: ${bank.length - toAdd.length - dupes} · near-duplicates skipped: ${dupes} · to add: ${toAdd.length}`);
  console.log(Object.entries(per).sort().map(([k, v]) => `${k}:${v}`).join(" "));
  if (!apply) { console.log("dry run: pass --apply to insert"); return; }

  for (let i = 0; i < toAdd.length; i += 100) {
    await db.insert(schema.questions).values(toAdd.slice(i, i + 100).map((q) => ({
      id: q.id, conceptId: q.concept_id, type: q.type, stem: q.stem, options: q.type === "MCQ" ? q.options : null,
      answer: q.answer, solution: q.solution, difficultyElo: q.difficulty_elo, source: "bank" as const, verified: true,
      targetsMisconceptionId: q.targets_misconception_id, distractorMisconceptions: q.distractor_misconceptions, status: "active" as const,
    })));
  }
  const [{ n }] = (await db.execute(`select count(*)::int n from questions where status = 'active'`) as unknown as { rows: { n: number }[] }).rows;
  console.log(`inserted ${toAdd.length}. Active questions now: ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
