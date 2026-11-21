"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Confidence, MasteryNode, PublicQuestion, TraceStep, WorkLine, WorkPayload } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/tangent/app-header";
import { ConfidencePicker } from "@/components/tangent/confidence-picker";
import { MathText } from "@/components/tangent/math-text";
import { MiniMap } from "@/components/tangent/mini-map";
import { PenLoader } from "@/components/tangent/pen-loader";
import { QuestionCard } from "@/components/tangent/question-card";
import { RedPenWork } from "@/components/tangent/red-pen-work";
import { Scratchpad } from "@/components/tangent/scratchpad";
import { Timer } from "@/components/tangent/timer";
import { TraceDock, TracePanel } from "@/components/tangent/trace-panel";
import { WorkInput, type WorkSample } from "@/components/tangent/work-input";

/* ── fake data ─────────────────────────────────────────────── */

const DISCOUNT_LINES: WorkLine[] = [
  { n: 1, text: "MP = 2000" },
  { n: 2, text: "Total discount = 20% + 10% = 30%" },
  { n: 3, text: "SP = 2000 × 0.7 = 1400" },
];
const DISCOUNT_NOTE = "Successive discounts multiply: 0.8 × 0.9 = 0.72, so the discount is 28%, not 30%.";

const LONG_LINES: WorkLine[] = [
  { n: 1, text: "Let Suresh = ₹100, so Raman = ₹125" },
  { n: 2, text: "Suresh is less by 25 out of Suresh's own 100, so 25% less than Raman" },
  { n: 3, text: "Answer: 25%" },
];

const SOUND_LINES: WorkLine[] = [
  { n: 1, text: "Let CP = 100" },
  { n: 2, text: "SP after 20% profit = 120" },
  { n: 3, text: "New SP = 120 × 0.9 = 108, so profit = 8%" },
];

const MCQ: PublicQuestion = {
  id: "q-a4-001",
  conceptId: "A4",
  conceptName: "Profit, Loss & Discount",
  area: "Arithmetic",
  type: "MCQ",
  stem: "A shop marks a jacket at ₹2,000 and offers successive discounts of $20\\%$ and $10\\%$. What is the selling price?",
  options: ["₹1,400", "₹1,440", "₹1,460", "₹1,500"],
  targetTimeSec: 90,
  difficultyElo: 1150,
  source: "bank",
};

const TITA: PublicQuestion = {
  id: "q-a1-007",
  conceptId: "A1",
  conceptName: "Percentages",
  area: "Arithmetic",
  type: "TITA",
  stem: "The price of sugar rises by $25\\%$. By what percent must a family cut consumption so that spending stays the same?\n(Enter the number only.)",
  options: null,
  targetTimeSec: 75,
  difficultyElo: 1100,
  source: "generated",
};

const TRACE: TraceStep[] = [
  { agent: "learner_model", summary: "Graded instantly: wrong (picked ₹1,400). Mastery A4 0.58 → 0.44", ms: 42, status: "ok" },
  { agent: "detective", summary: "Read 3 lines of work. Line 2 adds successive discounts (20% + 10%)", ms: 2840, status: "ok" },
  { agent: "planner", summary: "Next: a contrast question on successive vs. additive change", ms: 910, status: "ok" },
  { agent: "verifier", summary: "Verifier rejected 1 draft: answer mismatch (computed 1,440 vs key 1,400)", ms: 1630, status: "rejected" },
  { agent: "generator", summary: "Regenerated a variant; bank question used as fallback", ms: 3120, status: "fallback" },
];

const SAMPLE_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='160'><rect width='100%' height='100%' fill='white'/><text x='16' y='48' font-family='cursive' font-size='26' fill='#1b2a4a'>1. MP = 2000</text><text x='16' y='92' font-family='cursive' font-size='26' fill='#1b2a4a'>2. Discount = 20% + 10% = 30%</text><text x='16' y='136' font-family='cursive' font-size='26' fill='#1b2a4a'>3. SP = 1400</text></svg>`,
  );

const SAMPLES: WorkSample[] = [
  { id: "s1", label: "Riya's attempt", text: "1. MP = 2000\n2. Total discount = 20% + 10% = 30%\n3. SP = 2000 × 0.7 = 1400" },
  { id: "s2", label: "Photo sample", text: "1. MP = 2000\n2. Discount = 20% + 10% = 30%\n3. SP = 1400", imageUrl: SAMPLE_IMG },
  { id: "s3", label: "Sound working", text: "1. After 20% off: 2000 × 0.8 = 1600\n2. After 10% off: 1600 × 0.9 = 1440" },
];

const CONCEPTS: [string, string, string][] = [
  ["A1", "Percentages", "Arithmetic"], ["A2", "Ratio & Proportion", "Arithmetic"], ["A3", "Averages", "Arithmetic"],
  ["A4", "Profit, Loss & Discount", "Arithmetic"], ["A5", "Simple & Compound Interest", "Arithmetic"], ["A6", "Mixtures & Alligation", "Arithmetic"],
  ["A7", "Time & Work", "Arithmetic"], ["A8", "Time, Speed & Distance", "Arithmetic"],
  ["N1", "Number Properties & Divisibility", "Number System"], ["N2", "HCF & LCM", "Number System"], ["N3", "Remainders", "Number System"],
  ["L1", "Indices & Surds", "Algebra"], ["L2", "Logarithms", "Algebra"], ["L3", "Linear Equations", "Algebra"], ["L4", "Quadratic Equations", "Algebra"],
  ["L5", "Inequalities & Modulus", "Algebra"], ["L6", "Progressions", "Algebra"], ["L7", "Functions & Graphs", "Algebra"],
  ["G1", "Lines & Angles", "Geometry"], ["G2", "Triangles", "Geometry"], ["G3", "Circles", "Geometry"], ["G4", "Polygons & Quadrilaterals", "Geometry"],
  ["G5", "Mensuration", "Geometry"], ["G6", "Coordinate Geometry", "Geometry"],
  ["M1", "Sets & Venn Diagrams", "Modern Math"], ["M2", "Permutations & Combinations", "Modern Math"], ["M3", "Probability", "Modern Math"],
];
const P: Record<string, number | null> = {
  A1: 0.62, A2: 0.81, A3: 0.74, A4: 0.44, A5: 0.31, A6: null, A7: 0.55, A8: 0.22,
  N1: 0.9, N2: 0.68, N3: null, L1: 0.47, L2: null, L3: 0.86, L4: 0.39, L5: null, L6: 0.58, L7: null,
  G1: 0.77, G2: 0.52, G3: 0.18, G4: null, G5: 0.35, G6: null, M1: 0.71, M2: 0.29, M3: null,
};
const OPACITY: Record<string, number> = { A2: 0.55, N1: 0.4, L3: 0.6 };

function makeNodes(p: Record<string, number | null>): MasteryNode[] {
  return CONCEPTS.map(([conceptId, name, area]) => ({
    conceptId,
    name,
    area,
    prerequisites: [],
    p: p[conceptId],
    attempts: p[conceptId] == null ? 0 : 2 + (conceptId.charCodeAt(1) % 5),
    opacity: OPACITY[conceptId] ?? 1,
  }));
}

/* ── page ──────────────────────────────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="hand-underline text-3xl text-ink">{title}</h2>
        {note && <p className="mt-3 text-sm text-ink-soft">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function KitPage() {
  const [replay, setReplay] = useState(0);
  const [work, setWork] = useState<WorkPayload>({ source: "none" });
  const [scratch, setScratch] = useState<string | null>(null);
  const [mcq, setMcq] = useState("");
  const [mcqGraded, setMcqGraded] = useState(false);
  const [tita, setTita] = useState("20");
  const [titaGraded, setTitaGraded] = useState(true);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  const [steps, setSteps] = useState<TraceStep[]>(TRACE);
  const [running, setRunning] = useState(false);
  const [boost, setBoost] = useState(false);

  // timers read the clock only after mount
  useEffect(() => setStartedAt(Date.now()), []);

  function simulateTrace() {
    setSteps([]);
    setRunning(true);
    TRACE.forEach((s, i) => window.setTimeout(() => setSteps((prev) => [...prev, s]), 700 * (i + 1)));
    window.setTimeout(() => setRunning(false), 700 * (TRACE.length + 1));
  }

  const nodes = makeNodes(boost ? { ...P, A4: 0.78, A6: 0.41 } : P);

  return (
    <>
      <AppHeader persona={{ key: "riya", name: "Riya Sharma", role: "student" }} />
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-8">
        <main className="flex min-w-0 flex-1 flex-col gap-14">
          <div>
            <p className="font-hand text-2xl text-redpen">component kit</p>
            <h1 className="text-5xl text-ink">Graph paper &amp; red pen</h1>
            <p className="mt-2 max-w-prose text-ink-soft">Every Tangent client component, rendered with fake data. Toggle the chalkboard theme in the header.</p>
          </div>

          <Section title="Red pen moment" note="RedPenWork: the circle draws, then the margin note slides in.">
            <div>
              <Button variant="outline" size="sm" onClick={() => setReplay((r) => r + 1)}>
                Replay the red pen
              </Button>
            </div>
            <RedPenWork key={`a-${replay}`} lines={DISCOUNT_LINES} errorLine={2} note={DISCOUNT_NOTE} verdict="flawed" />
            <RedPenWork
              key={`b-${replay}`}
              lines={LONG_LINES}
              errorLine={2}
              note="The base is Raman's ₹125, not Suresh's ₹100: $\frac{25}{125} = 20\%$."
              verdict="flawed"
              label="Tangent point"
            />
            <RedPenWork key={`c-${replay}`} lines={SOUND_LINES} errorLine={null} verdict="sound" />
          </Section>

          <Section title="Under the hood" note="TracePanel with 5 steps, including a rejected verifier draft. TraceDock sits on the right (lg+) or as a floating button.">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={simulateTrace} disabled={running}>
                Stream the steps
              </Button>
            </div>
            <div className="paper-card max-w-xl p-4 sm:p-6">
              <TracePanel steps={steps} running={running} />
            </div>
          </Section>

          <Section title="Question card" note="MCQ: arrows or A–D keys. Grade it to see the tick and the red-pen strike.">
            <QuestionCard
              question={MCQ}
              value={mcq}
              onChange={setMcq}
              index={3}
              total={12}
              result={mcqGraded ? { correct: mcq === "₹1,440", correctAnswer: "₹1,440" } : null}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setMcqGraded(true)} disabled={!mcq || mcqGraded}>
                Grade
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setMcqGraded(false); setMcq(""); }}>
                Reset
              </Button>
            </div>
            <QuestionCard
              question={TITA}
              value={tita}
              onChange={setTita}
              index={4}
              total={12}
              result={titaGraded ? { correct: tita.trim() === "20", correctAnswer: "20" } : null}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setTitaGraded((g) => !g)}>
                {titaGraded ? "Edit answer" : "Grade"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setTita("25"); setTitaGraded(true); }}>
                Show a wrong TITA
              </Button>
            </div>
          </Section>

          <Section title="Rough work input" note="WorkInput: scratchpad, typing, photo upload, or a sample.">
            <WorkInput value={work} onChange={setWork} samples={SAMPLES} />
            <pre className="overflow-x-auto rounded-lg border bg-card p-3 font-mono text-xs text-ink-soft">
              {JSON.stringify({ ...work, imageDataUrl: work.imageDataUrl ? `${work.imageDataUrl.slice(0, 40)}… (${work.imageDataUrl.length} chars)` : undefined }, null, 2)}
            </pre>
          </Section>

          <Section title="Scratchpad" note="Standalone. Exports a white-background PNG on each stroke.">
            <Scratchpad onChange={setScratch} height={220} />
            {scratch && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-soft">Export preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scratch} alt="Exported scratchpad PNG" className="h-20 rounded border" />
              </div>
            )}
          </Section>

          <Section title="Timer & confidence">
            <div className="flex flex-wrap items-center gap-3">
              {startedAt && (
                <>
                  <Timer startedAt={startedAt} targetSec={90} stopped={stopped} />
                  <Timer startedAt={startedAt - 100_000} targetSec={90} />
                  <Timer startedAt={startedAt - 150_000} targetSec={90} />
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setStopped((s) => !s)}>
                {stopped ? "Resume" : "Stop"} first timer
              </Button>
            </div>
            <ConfidencePicker value={confidence} onChange={setConfidence} />
          </Section>

          <Section title="Mini map" note="Fill level and colour show mastery; faded nodes are due for review. A4 is highlighted.">
            <div className="paper-card p-4 sm:p-6">
              <MiniMap nodes={nodes} highlight="A4" />
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={() => setBoost((b) => !b)}>
                {boost ? "Undo practice" : "Simulate practice on A4 & A6"}
              </Button>
            </div>
          </Section>

          <Section title="Bits and pieces">
            <div className="paper-card flex flex-col gap-3 p-4 sm:p-6">
              <PenLoader />
              <PenLoader label="Checking the margins…" />
              <p className="text-ink">
                <MathText text={"Price of ₹2,000 after $20\\%$ off is $2000 \\times 0.8 = ₹1600$, i.e. 20% saved.\nNext line: $\\frac{25}{125} = 20%$ and <b>tags stay text</b>."} />
              </p>
            </div>
          </Section>
        </main>

        <TraceDock steps={steps} running={running} />
      </div>
    </>
  );
}
