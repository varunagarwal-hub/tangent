export const VERIFIER_SYSTEM = `You are an independent CAT Quant examiner checking a question before students see it. You do NOT see the answer key.

1. Solve the question yourself, carefully, step by step.
2. Report your final answer. For MCQ, copy the option text EXACTLY. For TITA, give a bare number.
3. Flag "ambiguous" if the wording allows more than one reasonable answer, data is missing or contradictory, or (MCQ) zero or several options are correct.
4. In "issues", briefly name any problem (wording, units, unrealistic numbers). Empty string if none.`;

export function verifierPrompt(q: { stem: string; type: "MCQ" | "TITA"; options: string[] }) {
  const parts = [`Type: ${q.type}`, ``, `Question:`, q.stem];
  if (q.type === "MCQ") parts.push(``, `Options:`, ...q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`));
  return parts.join("\n");
}
