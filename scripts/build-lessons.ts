/**
 * Builds one concept card per concept → data/lessons.json (committed; no AI at runtime).
 *   npx tsx scripts/build-lessons.ts            (resumable: skips concepts already in the file)
 *   npx tsx scripts/build-lessons.ts --redo A1  (rebuild one concept)
 *
 * 1. Flash (generator) writes the key idea, formulas, a worked example (question, steps, answer),
 *    a one-line fix per misconception, and two CAT shortcuts.
 * 2. Pro (verifier) re-solves the worked example from the question alone; the card is kept only
 *    if its answer matches. Up to 3 attempts per concept.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

interface Concept { id: string; name: string; area: string; prerequisites: string[] }
interface Misconception { id: string; concept_id: string; name: string; description: string }
export interface Lesson {
  conceptId: string;
  keyIdea: string;
  formulas: { label: string; latex: string }[];
  example: { question: string; steps: string[]; answer: string };
  tangents: { misconceptionId: string; fix: string }[];
  shortcuts: { title: string; body: string }[];
  verified: { answer: string; by: "pro" };
}

const OUT = "data/lessons.json";

async function main() {
  const { generateStructured } = await import("../src/lib/ai/gemini");
  const { answersMatch } = await import("../src/lib/grading");
  const concepts: Concept[] = JSON.parse(readFileSync("data/concepts.json", "utf8"));
  const mcs: Misconception[] = JSON.parse(readFileSync("data/misconceptions.json", "utf8"));
  const lessons: Lesson[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const redo = process.argv.includes("--redo") ? process.argv[process.argv.indexOf("--redo") + 1] : null;
  const have = new Set(lessons.filter((l) => l.conceptId !== redo).map((l) => l.conceptId));
  const todo = concepts.filter((c) => !have.has(c.id));
  console.log(`${todo.length} concepts to build`);

  const Draft = z.object({
    key_idea: z.string().describe("2–3 sentences, mentor tone, the one idea that makes this topic click for CAT"),
    formulas: z.array(z.object({ label: z.string(), latex: z.string().describe("KaTeX, no surrounding $") })).describe("3–5 key formulas"),
    example: z.object({
      question: z.string().describe("A CAT-level problem (medium difficulty) with a single numeric or short answer. Plain text; use $…$ only for real formulas."),
      steps: z.array(z.string()).describe("3–6 solution steps, each one short sentence, plain text maths (×, ÷, −, ^, √) or $…$"),
      answer: z.string().describe("Final answer only, e.g. '24' or '₹1,350' or '3/8'"),
    }),
    tangents: z.array(z.object({ misconception_id: z.string(), fix: z.string().describe("One sentence: what to do instead") })),
    shortcuts: z.array(z.object({ title: z.string().describe("3–6 words"), body: z.string().describe("1–2 sentences with a tiny example") })).describe("Exactly 2 CAT shortcuts or tricks"),
  });
  const Solve = z.object({ working: z.string(), answer: z.string().describe("Final answer only") });

  const save = () => {
    const order = new Map(concepts.map((c, i) => [c.id, i]));
    lessons.sort((a, b) => (order.get(a.conceptId) ?? 0) - (order.get(b.conceptId) ?? 0));
    writeFileSync(OUT, JSON.stringify(lessons, null, 1) + "\n");
  };

  const queue = [...todo];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const c = queue.shift()!;
      const own = mcs.filter((m) => m.concept_id === c.id);
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          const { data: d } = await generateStructured({
            agent: "generator", tier: "fast", thinking: "LOW", cache: false, timeoutMs: 60_000,
            system: "You write short, precise concept cards for CAT Quant aspirants in India. Indian context (₹, km/h). No fluff.",
            prompt: [
              `Concept: ${c.name} (${c.area})`,
              `Common misconceptions (write one fix for EACH, using these ids):\n${own.map((m) => `- ${m.id}: ${m.name}: ${m.description}`).join("\n")}`,
              attempt > 1 ? "Your previous worked example had an arithmetic error. Write a NEW, simpler example and check every step." : "",
            ].filter(Boolean).join("\n\n"),
            schema: Draft, inputSummary: `lesson ${c.id} (try ${attempt})`,
          });
          const { data: v } = await generateStructured({
            agent: "verifier", tier: "smart", thinking: "LOW", cache: false, timeoutMs: 90_000,
            system: "Solve the problem independently and carefully. Give the final answer only in `answer`.",
            prompt: d.example.question, schema: Solve, inputSummary: `lesson check ${c.id}`, temperature: 0.1,
          });
          if (!answersMatch(v.answer, d.example.answer)) { console.log(`✗ ${c.id} try ${attempt}: card ${d.example.answer} vs pro ${v.answer}`); continue; }
          const ids = new Set(own.map((m) => m.id));
          const tangents = d.tangents.filter((t) => ids.has(t.misconception_id)).map((t) => ({ misconceptionId: t.misconception_id, fix: t.fix.trim() }));
          const lesson: Lesson = {
            conceptId: c.id,
            keyIdea: d.key_idea.trim(),
            formulas: d.formulas.slice(0, 5),
            example: { question: d.example.question.trim(), steps: d.example.steps.map((s) => s.trim()).filter(Boolean), answer: d.example.answer.trim() },
            tangents,
            shortcuts: d.shortcuts.slice(0, 2),
            verified: { answer: v.answer, by: "pro" },
          };
          const i = lessons.findIndex((l) => l.conceptId === c.id);
          if (i >= 0) lessons[i] = lesson; else lessons.push(lesson);
          save();
          ok = true;
          console.log(`✓ ${c.id} ${c.name} (${tangents.length}/${own.length} fixes)`);
        } catch (e) {
          console.log(`✗ ${c.id} try ${attempt}: ${String(e).slice(0, 100)}`);
        }
      }
      if (!ok) console.log(`!! ${c.id} gave up after 3 tries`);
    }
  }));
  console.log(`\n${lessons.length}/${concepts.length} lessons in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
