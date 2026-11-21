/**
 * Detective evaluation on data/evals/detective.json (labelled wrong solutions).
 *   npx tsx scripts/eval-detective.ts
 * Writes accuracy + confusion summary to data/evals/results.json (shown on /under-the-hood).
 * Uses only seed few-shot examples (never the eval cases themselves).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, writeFileSync } from "node:fs";

interface Case {
  id: string;
  concept_id: string;
  question: string;
  correct_answer: string;
  student_answer: string;
  work_text: string;
  expected_misconception_id: string;
  expected_error_line: number;
}

async function main() {
  const { diagnose, toLines } = await import("../src/lib/agents/detective");
  const { answersMatch } = await import("../src/lib/grading");
  const { misconceptionsFor } = await import("../src/lib/content");
  const cases: Case[] = JSON.parse(readFileSync("data/evals/detective.json", "utf8"));
  const fewshot: { misconception_id: string; work_text: string }[] = JSON.parse(readFileSync("data/fewshot-seed.json", "utf8"));

  const results: Array<Record<string, unknown>> = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const c = queue.shift()!;
        const ids = new Set(misconceptionsFor(c.concept_id).map((m) => m.id));
        const examples = fewshot.filter((f) => ids.has(f.misconception_id)).slice(0, 3).map((f) => ({ ...f, source: "seed" }));
        const t0 = Date.now();
        try {
          const { diagnosis } = await diagnose({
            conceptId: c.concept_id,
            question: c.question,
            options: null,
            correctAnswer: c.correct_answer,
            solution: `Correct answer: ${c.correct_answer}`,
            studentAnswer: c.student_answer,
            isCorrect: answersMatch(c.student_answer, c.correct_answer),
            lines: toLines(c.work_text),
            examples,
          });
          const mcOk = diagnosis.misconceptionId === c.expected_misconception_id;
          const lineOk = diagnosis.errorLineNumber === c.expected_error_line;
          results.push({ id: c.id, expected: c.expected_misconception_id, got: diagnosis.misconceptionId, mcOk, expectedLine: c.expected_error_line, gotLine: diagnosis.errorLineNumber, lineOk, confidence: diagnosis.confidence, ms: Date.now() - t0 });
          console.log(`${mcOk ? "✓" : "✗"} ${c.id} ${c.expected_misconception_id} → ${diagnosis.misconceptionId ?? "none"} | line ${c.expected_error_line} → ${diagnosis.errorLineNumber ?? "-"} ${lineOk ? "✓" : "✗"} (${Date.now() - t0}ms)`);
        } catch (e) {
          results.push({ id: c.id, expected: c.expected_misconception_id, got: null, mcOk: false, lineOk: false, error: String(e).slice(0, 120) });
          console.log(`✗ ${c.id} error`);
        }
      }
    }),
  );

  results.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const n = results.length;
  const mcAcc = results.filter((r) => r.mcOk).length / n;
  const lineAcc = results.filter((r) => r.lineOk).length / n;
  const bothAcc = results.filter((r) => r.mcOk && r.lineOk).length / n;
  const confusions = results.filter((r) => !r.mcOk).map((r) => ({ expected: r.expected, got: r.got ?? "none" }));
  const summary = {
    ran_at: new Date().toISOString(),
    model: process.env.GEMINI_MODEL_FAST,
    cases: n,
    misconception_accuracy: +mcAcc.toFixed(3),
    error_line_accuracy: +lineAcc.toFixed(3),
    both_accuracy: +bothAcc.toFixed(3),
    avg_ms: Math.round(results.reduce((a, r) => a + ((r.ms as number) ?? 0), 0) / n),
    confusions,
    results,
  };
  writeFileSync("data/evals/results.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nMisconception accuracy ${(mcAcc * 100).toFixed(0)}% · error-line accuracy ${(lineAcc * 100).toFixed(0)}% · both ${(bothAcc * 100).toFixed(0)}% · avg ${summary.avg_ms}ms`);
}
main();
