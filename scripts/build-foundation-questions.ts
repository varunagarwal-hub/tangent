/**
 * Builds school-level questions for the foundation check → data/foundation-questions.json (committed; no runtime AI).
 *   npx tsx scripts/build-foundation-questions.ts         (resumable: tops each skill up to PER_SKILL)
 *
 * Flash (generator) writes a batch of MCQs per skill; Pro (verifier) solves each one independently
 * from the stem and options; a question is kept only if Pro picks the same option.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

interface Skill { id: string; name: string; description: string }
export interface FoundationQuestion { id: string; skillId: string; stem: string; options: string[]; answerIndex: number; explanation: string }

const OUT = "data/foundation-questions.json";
const PER_SKILL = 10;

async function main() {
  const { generateStructured } = await import("../src/lib/ai/gemini");
  const skills: Skill[] = JSON.parse(readFileSync("data/foundations.json", "utf8"));
  const bank: FoundationQuestion[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const save = () => {
    bank.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
    writeFileSync(OUT, JSON.stringify(bank, null, 1) + "\n");
  };

  const Batch = z.object({
    questions: z.array(
      z.object({
        stem: z.string().describe("One short question. Plain text maths (×, ÷, −, ^, √, fractions like 3/4); $…$ only if unavoidable."),
        options: z.array(z.string()).describe("Exactly 4 distinct options; wrong ones should be the answers a student with the usual misconception would get"),
        answer_index: z.number().int().describe("0-based index of the correct option"),
        explanation: z.string().describe("One or two sentences: how to get it, in a friendly tutor voice"),
      }),
    ),
  });
  const Solve = z.object({ working: z.string(), answer_index: z.number().int().describe("0-based index of the correct option") });

  await Promise.all(
    skills.map(async (sk) => {
      for (let round = 0; round < 4; round++) {
        const have = bank.filter((q) => q.skillId === sk.id);
        const need = PER_SKILL - have.length;
        if (need <= 0) break;
        try {
          const { data } = await generateStructured({
            agent: "generator", tier: "fast", thinking: "LOW", cache: false, timeoutMs: 60_000,
            system: "You write quick school-level maths check questions (Indian classes 6–10) for adults preparing for CAT who may have forgotten the basics. Indian context (₹, km). Each question takes under a minute without a calculator.",
            prompt: [
              `Skill: ${sk.name}: ${sk.description}`,
              `Write ${need + 2} different questions, mixing easy and medium. Vary the sub-topic and the numbers.`,
              have.length ? `Avoid repeating these:\n${have.map((q) => `- ${q.stem}`).join("\n")}` : "",
            ].filter(Boolean).join("\n\n"),
            schema: Batch, inputSummary: `foundation ${sk.id} batch ${round}`,
          });
          for (const q of data.questions) {
            if (bank.filter((b) => b.skillId === sk.id).length >= PER_SKILL) break;
            const opts = q.options.map((o) => o.trim());
            if (opts.length !== 4 || new Set(opts.map((o) => o.toLowerCase())).size !== 4 || q.answer_index < 0 || q.answer_index > 3) continue;
            if (bank.some((b) => b.stem === q.stem.trim())) continue;
            const { data: v } = await generateStructured({
              agent: "verifier", tier: "smart", thinking: "LOW", cache: false, timeoutMs: 60_000,
              system: "Solve the multiple-choice question carefully and independently. Reply with the 0-based index of the correct option.",
              prompt: `${q.stem}\n\n${opts.map((o, i) => `${i}. ${o}`).join("\n")}`,
              schema: Solve, inputSummary: `foundation check ${sk.id}`, temperature: 0.1,
            });
            if (v.answer_index !== q.answer_index) { console.log(`✗ ${sk.id}: key ${q.answer_index} vs pro ${v.answer_index}: ${q.stem.slice(0, 60)}`); continue; }
            const n = Math.max(0, ...bank.filter((b) => b.skillId === sk.id).map((b) => Number(b.id.split("-")[1]))) + 1;
            bank.push({ id: `${sk.id}-${n}`, skillId: sk.id, stem: q.stem.trim(), options: opts, answerIndex: q.answer_index, explanation: q.explanation.trim() });
            save();
          }
          console.log(`✓ ${sk.id} now ${bank.filter((b) => b.skillId === sk.id).length}/${PER_SKILL}`);
        } catch (e) {
          console.log(`✗ ${sk.id} batch error: ${String(e).slice(0, 100)}`);
        }
      }
    }),
  );
  save();
  console.log(`\n${bank.length} foundation questions in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
