/**
 * Formula & shortcut flashcards → data/flashcards.json (committed; no runtime AI).
 *   npx tsx scripts/build-flashcards.ts
 *
 * Built from the concept cards (data/lessons.json): up to 3 formulas + 2 shortcuts per concept.
 * Pro (verifier) reviews each concept's set once and flags anything mathematically wrong or
 * misleading; flagged cards are dropped.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

interface Lesson { conceptId: string; formulas: { label: string; latex: string }[]; shortcuts: { title: string; body: string }[] }
interface Concept { id: string; name: string }
export interface Flashcard { id: string; conceptId: string; kind: "formula" | "shortcut"; front: string; back: string }

async function main() {
  const { generateStructured } = await import("../src/lib/ai/gemini");
  const lessons: Lesson[] = JSON.parse(readFileSync("data/lessons.json", "utf8"));
  const concepts: Concept[] = JSON.parse(readFileSync("data/concepts.json", "utf8"));
  const name = new Map(concepts.map((c) => [c.id, c.name]));
  const Check = z.object({ bad: z.array(z.number().int()).describe("1-based numbers of cards that are wrong or misleading; empty if all are fine"), notes: z.string() });

  const out: Flashcard[] = [];
  let dropped = 0;
  await Promise.all(
    lessons.map(async (l) => {
      const cards: Flashcard[] = [
        ...l.formulas.slice(0, 3).map((f, i) => ({ id: `${l.conceptId}-f${i + 1}`, conceptId: l.conceptId, kind: "formula" as const, front: f.label, back: `$$${f.latex}$$` })),
        ...l.shortcuts.slice(0, 2).map((sc, i) => ({ id: `${l.conceptId}-s${i + 1}`, conceptId: l.conceptId, kind: "shortcut" as const, front: sc.title, back: sc.body })),
      ];
      try {
        const { data } = await generateStructured({
          agent: "verifier", tier: "smart", thinking: "LOW", cache: false, timeoutMs: 90_000,
          system: "You check revision flashcards for CAT Quant. Flag a card only if its back is mathematically wrong, or misleading as stated (e.g. a formula missing a condition that changes the answer). Do not flag style.",
          prompt: `Topic: ${name.get(l.conceptId)}\n\n${cards.map((c, i) => `${i + 1}. FRONT: ${c.front}\n   BACK: ${c.back}`).join("\n")}`,
          schema: Check, inputSummary: `flashcards ${l.conceptId}`, temperature: 0.1,
        });
        const bad = new Set(data.bad);
        cards.forEach((c, i) => (bad.has(i + 1) ? dropped++ : out.push(c)));
        console.log(`${bad.size ? "~" : "✓"} ${l.conceptId}: kept ${cards.length - bad.size}/${cards.length}${bad.size ? ` (${data.notes.slice(0, 120)})` : ""}`);
      } catch (e) {
        console.log(`✗ ${l.conceptId}: check failed, keeping none (${String(e).slice(0, 80)})`);
        dropped += cards.length;
      }
    }),
  );
  out.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  writeFileSync("data/flashcards.json", JSON.stringify(out, null, 1) + "\n");
  console.log(`\n${out.length} flashcards saved, ${dropped} dropped.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
