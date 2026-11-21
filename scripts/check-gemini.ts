/** Smoke test: one structured call per model tier. Run: npx tsx scripts/check-gemini.ts */
import { config } from "dotenv";
config({ path: ".env.local" });

import { z } from "zod";

async function main() {
  const { generateStructured, modelId } = await import("../src/lib/ai/gemini");
  const schema = z.object({ answer: z.number(), working: z.string() });
  for (const tier of ["fast", "smart"] as const) {
    try {
      const r = await generateStructured({
        agent: "verifier",
        tier,
        system: "You are a precise CAT Quant solver. Reply in JSON.",
        prompt: "A price rises 20% and then falls 20%. What is the net % change? Give answer as a number (negative for a fall).",
        schema,
        inputSummary: `smoke test (${tier})`,
        cache: false,
      });
      console.log(`${tier} (${modelId(tier)}): OK in ${r.ms}ms → answer ${r.data.answer}`);
    } catch (e) {
      console.log(`${tier} (${modelId(tier)}): FAILED → ${e instanceof Error ? e.message.slice(0, 300) : e}`);
    }
  }
}
main();
