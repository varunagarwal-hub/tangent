import type { ReactNode } from "react";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";

function Card({
  kicker,
  title,
  body,
  visual,
  className,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article className={cn("landing-bento paper-card group relative flex flex-col overflow-hidden", className)}>
      <div className="relative flex min-h-40 flex-1 items-center justify-center border-b border-dashed border-border bg-paper/60 px-5 py-6">
        {visual}
      </div>
      <div className="p-5 sm:p-6">
        <p className="font-hand text-xl leading-none text-redpen">{kicker}</p>
        <h3 className="mt-1.5 text-2xl leading-tight text-ink sm:text-[1.7rem]">{title}</h3>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{body}</p>
      </div>
      {children}
    </article>
  );
}

/* ── mini visuals ─────────────────────────────────────────── */

function ReadsVisual() {
  return (
    <div className="grid w-full max-w-lg grid-cols-3 gap-3" aria-hidden="true">
      {/* typed */}
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">typed</p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-ink">
          x = 2000
          <br />
          <span className="relative">
            d = 20+10
            <svg viewBox="0 0 80 26" preserveAspectRatio="none" className="absolute -inset-x-1.5 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.75rem)] overflow-visible">
              <path d="M6 14 C 4 3, 74 1, 76 12 C 78 24, 8 26, 4 12" fill="none" className="stroke-redpen" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            </svg>
          </span>
          <br />
          SP = 1400
        </p>
      </div>
      {/* drawn */}
      <div className="graph-paper rounded-lg border p-3 shadow-sm">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">drawn</p>
        <svg viewBox="0 0 100 60" className="mt-1 h-auto w-full">
          <path d="M8 40 C 14 20, 22 20, 26 38 S 38 52, 44 30 M52 34 L 66 34 M58 27 L 58 41 M74 22 C 86 18, 90 30, 78 36 C 90 38, 92 52, 74 50" fill="none" className="stroke-ink" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="60" cy="34" rx="15" ry="12" fill="none" className="stroke-redpen" strokeWidth="1.8" transform="rotate(-8 60 34)" />
        </svg>
      </div>
      {/* photographed */}
      <div className="rotate-2 rounded-lg border bg-card p-2 pb-4 shadow-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">photo</p>
        <div className="tg-notebook mt-1 h-16 rounded-sm">
          <p className="pl-5 pt-1 font-hand text-[0.95rem] leading-[1.1rem] text-ink">
            SP = 2000×0.7
            <br />
            <span className="tg-error-line">= 1400</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function MasteryVisual() {
  const nodes = [
    { x: 30, y: 30, c: "fill-mastery-high", o: 1 },
    { x: 90, y: 22, c: "fill-mastery-mid", o: 1 },
    { x: 150, y: 36, c: "fill-mastery-high", o: 0.45 },
    { x: 58, y: 86, c: "fill-mastery-low", o: 1 },
    { x: 122, y: 90, c: "fill-mastery-high", o: 0.7 },
  ];
  return (
    <svg viewBox="0 0 180 116" className="h-auto w-full max-w-[15rem]" aria-hidden="true">
      <g className="stroke-ink" strokeOpacity="0.35" strokeWidth="1.5">
        <path d="M30 30 L 58 86 M90 22 L 58 86 M90 22 L 122 90 M150 36 L 122 90" />
      </g>
      {nodes.map((n, k) => (
        <g key={k} opacity={n.o}>
          <circle cx={n.x} cy={n.y} r="12" className={n.c} />
          <circle cx={n.x} cy={n.y} r="12" fill="none" className="stroke-ink" strokeOpacity="0.25" />
        </g>
      ))}
      <text x="150" y="64" textAnchor="middle" className="font-hand fill-ink-soft" fontSize="13">
        fading: due
      </text>
      <path d="M150 54 L 150 50" className="stroke-ink-soft" />
    </svg>
  );
}

function LifecycleVisual() {
  const steps = [
    { t: "Off on a tangent", c: "border-mastery-low text-mastery-low" },
    { t: "Fixing", c: "border-mastery-mid text-amber-ink" },
    { t: "Back on the curve", c: "border-mastery-high text-mastery-high" },
  ];
  return (
    <ol className="flex w-full flex-col items-center gap-1.5" aria-label="Misconception lifecycle">
      {steps.map((s, k) => (
        <li key={s.t} className="flex flex-col items-center gap-1.5">
          <span className={cn("rounded-full border-2 bg-card px-3 py-1 font-hand text-xl leading-none", s.c)}>{s.t}</span>
          {k < steps.length - 1 && (
            <svg viewBox="0 0 12 16" className="h-4 w-3" aria-hidden="true">
              <path d="M6 1 L 6 14 M2 10 L 6 14 L 10 10" fill="none" className="stroke-ink-soft" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </li>
      ))}
    </ol>
  );
}

function VerifierVisual() {
  return (
    <div className="flex w-full max-w-[16rem] items-center justify-between gap-2" aria-hidden="true">
      <div className="rounded-lg border bg-card px-3 py-2 text-center shadow-sm">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">generator</p>
        <p className="font-hand text-xl text-ink">writes Q</p>
      </div>
      <svg viewBox="0 0 60 40" className="h-10 w-14 shrink-0">
        <path d="M4 14 L 52 14 M46 9 L 52 14 L 46 19" fill="none" className="stroke-ink" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M56 28 L 8 28 M14 23 L 8 28 L 14 33" fill="none" className="stroke-redpen" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="rounded-lg border bg-card px-3 py-2 text-center shadow-sm">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">verifier</p>
        <p className="font-hand text-xl text-mastery-high">solves it ✓</p>
      </div>
    </div>
  );
}

function SkipVisual() {
  const bars = [0.82, 0.71, 0.6, 0.48, 0.36, 0.22];
  return (
    <div className="w-full max-w-[15rem]" aria-hidden="true">
      <div className="relative flex h-20 items-end gap-2 border-b border-ink/30">
        {bars.map((b, k) => (
          <div
            key={k}
            className={cn("flex-1 rounded-t-sm", b >= 0.55 ? "bg-mastery-high" : "tg-hatch")}
            style={{ height: `${b * 100}%` }}
          />
        ))}
        <div className="absolute inset-x-0 border-t-2 border-dashed border-redpen" style={{ bottom: "55%" }} />
        <span className="absolute -top-1 right-0 font-hand text-lg leading-none text-redpen">skip below 0.55</span>
      </div>
      <p className="mt-2 flex justify-between font-mono text-xs text-ink-soft">
        <span>+3 right</span>
        <span>−1 wrong</span>
        <span>TITA 0</span>
      </p>
    </div>
  );
}

function TeacherVisual() {
  const grid = [
    "hhmlhh",
    "hmllmh",
    "mhlmhh",
    "hhlhmu",
  ];
  const cls: Record<string, string> = { h: "tg-cell-high", m: "tg-cell-mid", l: "tg-cell-low", u: "tg-cell-unknown" };
  return (
    <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10" aria-hidden="true">
      <div className="grid grid-cols-6 gap-1">
        {grid.join("").split("").map((c, k) => (
          <span key={k} className={cn("tg-cell", cls[c])} />
        ))}
      </div>
      <div className="tg-notebook w-full max-w-xs rotate-[-1.5deg] rounded-lg border px-4 py-3 pl-12 shadow-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">Monday · 40 min</p>
        <p className="font-hand text-xl leading-8 text-ink">
          1. <span className="highlight">Successive %</span>: 14 of 32 add them
          <br />
          2. Contrast drill, then 6 mixed Qs
        </p>
      </div>
      <div className="rounded-lg border-2 border-dashed border-redpen/60 bg-card px-3 py-2 text-center">
        <p className="font-hand text-lg leading-tight text-redpen">
          &ldquo;That&apos;s not it,
          <br />
          it&apos;s a units slip&rdquo;
        </p>
        <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-ink-soft">teacher override → detective</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="mt-28 sm:mt-36" aria-labelledby="features-title">
      <p className="font-hand text-2xl text-redpen">what&apos;s in the notebook</p>
      <h2 id="features-title" className="mt-1 max-w-3xl text-4xl text-ink sm:text-5xl">
        A mentor that marks <span className="hand-underline">the reasoning</span>, not just the answer
      </h2>

      <BentoGrid className="mt-10 auto-rows-auto grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className="md:col-span-2"
          kicker="reads your reasoning"
          title="Typed, drawn or photographed: it reads every line"
          body="Scribble on the scratchpad, type your steps, or snap a photo of your notebook. Gemini vision transcribes it, and the Detective finds the exact line where you went off on a tangent."
          visual={<ReadsVisual />}
        >
          <BorderBeam size={120} duration={9} colorFrom="var(--redpen)" colorTo="var(--highlighter-solid)" borderWidth={2} />
        </Card>
        <Card
          kicker="mastery map"
          title="A map that remembers forgetting"
          body="27 CAT Quant concepts, each filling red → amber → green as you learn. Nodes fade as they fall due, so revision is visible, not a guess."
          visual={<MasteryVisual />}
        />
        <Card
          kicker="misconception lifecycle"
          title="Every slip gets followed up"
          body="A misconception isn't closed after one right answer. Tangent tracks it until you've proved it on fresh questions, spaced over days."
          visual={<LifecycleVisual />}
        />
        <Card
          kicker="generator ↔ verifier"
          title="Every question is solved before you see it"
          body="One agent writes a question at your exact difficulty. A second solves it independently. If the answers disagree, the question never reaches you."
          visual={<VerifierVisual />}
        />
        <Card
          kicker="skip coach"
          title="Negative marking is a strategy"
          body="Replays your history under CAT scoring (+3 / −1, TITA without negatives) and shows how many marks smarter skipping would have kept."
          visual={<SkipVisual />}
        />
        <Card
          className="md:col-span-2 lg:col-span-3"
          kicker="for teachers"
          title="See the whole batch's tangents, plan Monday's class in a minute"
          body="A concept × student heatmap, a leaderboard of the class's misconceptions, and a lesson plan written around them. When a teacher overrides a diagnosis, the Detective learns from it: teachers train the detective."
          visual={<TeacherVisual />}
        />
      </BentoGrid>
    </section>
  );
}
