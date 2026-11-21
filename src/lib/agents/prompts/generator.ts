export const GENERATOR_SYSTEM = `You write original CAT (IIM Common Admission Test) Quantitative Aptitude questions.

Style: CAT-realistic, crisp Indian-English wording, realistic numbers (₹, km/h, days, litres), no trick wording, exactly one correct answer. The question must be answerable in about the target time without a calculator.

Math formatting: write math in LaTeX inside $...$ (e.g. $\\frac{3}{5}$, $x^2$). Keep plain words outside $...$. Never use $$ display math.

Types:
- MCQ: exactly 4 distinct options. "answer" must be copied EXACTLY from one of the options. Each wrong option should be the result of a specific, real mistake; tag those in distractor_misconceptions using ONLY the misconception ids provided.
- TITA (type in the answer): "options" is an empty array; "answer" is a bare number (integer or terminating decimal, no units, no commas).

Solution: short numbered steps ("1. ...\\n2. ..."), ending with the final answer. No fluff.

Difficulty: easy = one idea, direct; medium = two steps or a small twist; hard = multi-step, CAT slot-3 level.`;

export function generatorPrompt(a: {
  conceptName: string;
  conceptId: string;
  area: string;
  band: "easy" | "medium" | "hard";
  type: "MCQ" | "TITA";
  targetTimeSec: number;
  target?: { id: string; name: string; description: string; contrast_question_idea: string } | null;
  misconceptions: { id: string; name: string }[];
  avoidStems?: string[];
  retryReason?: string;
}) {
  const lines = [
    `Concept: ${a.conceptName} (${a.conceptId}, ${a.area})`,
    `Type: ${a.type}`,
    `Difficulty: ${a.band}`,
    `Target solve time: ~${a.targetTimeSec}s`,
    ``,
    `Misconception ids you may use for distractor tags:`,
    ...a.misconceptions.map((m) => `- ${m.id}: ${m.name}`),
  ];
  if (a.target) {
    lines.push(
      ``,
      `This is a CONTRAST question that targets ${a.target.id} ("${a.target.name}"): ${a.target.description}`,
      `Idea: ${a.target.contrast_question_idea}`,
      a.type === "MCQ"
        ? `A student holding this misconception must land on one specific wrong option; include that option and tag it with ${a.target.id}.`
        : `A student holding this misconception must get a clearly different number from the correct one.`,
    );
  }
  if (a.avoidStems?.length) {
    lines.push(``, `Do not repeat these existing questions:`, ...a.avoidStems.slice(-8).map((s) => `- ${s.slice(0, 140)}`));
  }
  if (a.retryReason) {
    lines.push(``, `Your previous draft was REJECTED by an independent verifier: ${a.retryReason}. Write a NEW question that avoids this problem; double-check the arithmetic.`);
  }
  return lines.join("\n");
}
