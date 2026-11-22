/**
 * Builds "Spot the Tangent" rounds → data/spot-rounds.json (committed; the game needs no AI at runtime).
 *   npx tsx scripts/build-spot-rounds.ts
 *
 * Sources: each misconception's wrong_reasoning_example (82) + the seed few-shot wrong solutions (23).
 * Never uses data/evals/detective.json (that's the Detective's eval set).
 *
 * Per round:
 *  1. Flash (Detective) writes the problem the work was attempting (only when the source has none),
 *     rewrites the work as 4–7 lines with the slip on a randomly chosen line (so the answer isn't
 *     always line 2), and a one-line fix.
 *  2. Pro (Verifier) picks the error line independently, without seeing Flash's answer.
 *  3. Kept only if both agree, so the game never marks a student wrong on a bad key.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

interface Misconception { id: string; concept_id: string; name: string; description: string; wrong_reasoning_example: string }
interface Fewshot { misconception_id: string; question: string; work_text: string }
export interface SpotRound {
  id: string;
  misconceptionId: string;
  conceptId: string;
  question: string;
  lines: { n: number; text: string }[];
  errorLine: number;
  fix: string;
  source: "library" | "seed";
}

const OUT = "data/spot-rounds.json";

const toLines = (work: string) =>
  work.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => ({ n: i + 1, text: l.replace(/^\d+[.)]\s*/, "") }));

async function main() {
  const { generateStructured } = await import("../src/lib/ai/gemini");
  const mcs: Misconception[] = JSON.parse(readFileSync("data/misconceptions.json", "utf8"));
  const seed: Fewshot[] = JSON.parse(readFileSync("data/fewshot-seed.json", "utf8"));
  const byId = new Map(mcs.map((m) => [m.id, m]));

  const sources = [
    ...mcs.map((m) => ({ id: `lib-${m.id}`, m, question: null as string | null, work: m.wrong_reasoning_example, source: "library" as const })),
    ...seed.map((s, i) => ({ id: `seed-${i}-${s.misconception_id}`, m: byId.get(s.misconception_id)!, question: s.question, work: s.work_text, source: "seed" as const })),
  ].filter((s) => s.m && toLines(s.work).length >= 2);

  const Draft = z.object({
    question: z.string().describe("The CAT-style problem this rough work was attempting, one or two sentences, numbers consistent with the work. If a question is given, repeat it exactly."),
    lines: z.array(z.string()).describe("The rewritten rough work, one step per entry, no line numbers"),
    error_line: z.number().int().describe("1-based number of the FIRST line where the reasoning goes wrong"),
    fix: z.string().describe("One sentence, mentor tone: what the student should have done instead on that line"),
  });
  const Check = z.object({ error_line: z.number().int().describe("1-based number of the FIRST line where the reasoning goes wrong") });

  const rounds: SpotRound[] = [];
  const dropped: string[] = [];
  const queue = [...sources];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const s = queue.shift()!;
      const orig = toLines(s.work).map((l) => `${l.n}. ${l.text}`).join("\n");
      const total = 4 + Math.floor(Math.random() * 4); // 4–7 lines
      const target = 1 + Math.floor(Math.random() * (total - 1)); // never the final "Answer" line
      try {
        const { data: d } = await generateStructured({
          agent: "detective", tier: "fast", thinking: "LOW", cache: false, timeoutMs: 30_000,
          system: "You prepare rounds for an error-spotting game for CAT Quant aspirants. You are given a student's rough work that contains one specific misconception.",
          prompt: [
            `Misconception: ${s.m.name}: ${s.m.description}`,
            s.question ? `Question (given): ${s.question}` : `Question: not given, write it.`,
            `Original rough work:\n${orig}`,
            [
              `Rewrite this rough work as exactly ${total} short lines, the way a student scribbles them.`,
              `The misconception must first appear on line ${target}. ${target > 1 ? `Lines 1–${target - 1} are CORRECT working (reading the data, setting up, correct intermediate steps).` : "Line 1 already contains the slip."}`,
              `Lines after ${target} carry the wrong value forward consistently, and line ${total} is "Answer: …".`,
              `Every line except line ${target} must be correct given the line before it. Use plain text maths (×, ÷, −, ^ for powers, √). Keep each line under 70 characters.`,
              `Set error_line to ${target}.`,
            ].join(" "),
          ].join("\n\n"),
          schema: Draft, inputSummary: `spot round ${s.id}`,
        });
        const lines = d.lines.map((t) => t.trim()).filter(Boolean).map((t, i) => ({ n: i + 1, text: t.replace(/^\d+[.)]\s*/, "") }));
        if (lines.length !== total || d.error_line !== target) {
          dropped.push(`${s.id}: wrote ${lines.length} lines / error ${d.error_line}, asked ${total} / ${target}`);
          console.log(`✗ ${s.id} (shape)`);
          continue;
        }
        const numbered = lines.map((l) => `${l.n}. ${l.text}`).join("\n");
        const { data: c } = await generateStructured({
          agent: "verifier", tier: "smart", thinking: "LOW", cache: false, timeoutMs: 60_000,
          system: "You check a student's rough work for a maths problem. Find the FIRST line where the reasoning goes wrong. Judge only the reasoning; do not assume anything about intent.",
          prompt: `Question: ${s.question ?? d.question}\n\nRough work:\n${numbered}`,
          schema: Check, inputSummary: `spot check ${s.id}`,
        });
        const ok = d.error_line === c.error_line && d.error_line >= 1 && d.error_line <= lines.length;
        if (!ok) { dropped.push(`${s.id}: flash ${d.error_line} vs pro ${c.error_line}`); console.log(`✗ ${s.id} (flash ${d.error_line}, pro ${c.error_line})`); continue; }
        rounds.push({ id: s.id, misconceptionId: s.m.id, conceptId: s.m.concept_id, question: s.question ?? d.question.trim(), lines, errorLine: d.error_line, fix: d.fix.trim(), source: s.source });
        console.log(`✓ ${s.id} line ${d.error_line}`);
      } catch (e) {
        dropped.push(`${s.id}: error ${String(e).slice(0, 80)}`); console.log(`✗ ${s.id} error`);
      }
    }
  }));
  rounds.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(OUT, JSON.stringify(rounds, null, 1) + "\n");
  console.log(`\n${rounds.length} rounds kept, ${dropped.length} dropped (Flash and Pro disagreed or errored). Saved ${OUT}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
