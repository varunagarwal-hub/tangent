"use client";

import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleSlash, ListChecks, MinusCircle } from "lucide-react";
import type { SkipCoachData } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
};

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;

/** A hand-drawn red-pen loop around the best point (not a perfect circle, on purpose). */
function RedPenCircle({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return <g />;
  const rx = 13;
  const ry = 10;
  const d = `M ${cx - rx + 1} ${cy - 3}
    C ${cx - rx} ${cy - ry - 2}, ${cx + rx + 2} ${cy - ry - 1}, ${cx + rx} ${cy + 1}
    C ${cx + rx - 1} ${cy + ry + 1}, ${cx - rx - 2} ${cy + ry}, ${cx - rx - 1} ${cy - 1}
    C ${cx - rx} ${cy - 5}, ${cx - rx + 5} ${cy - ry}, ${cx + 2} ${cy - ry - 3}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="var(--redpen)" />
      <path d={d} fill="none" stroke="var(--redpen)" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Chip({ icon: Icon, children, tone = "ink" }: { icon: typeof ListChecks; children: React.ReactNode; tone?: "ink" | "red" | "green" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
        tone === "red" && "border-redpen/40 bg-redpen/8 text-redpen",
        tone === "green" && "border-mastery-high/40 bg-mastery-high/10 text-mastery-high",
        tone === "ink" && "border-border bg-card text-ink",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SkipCoach({ data }: { data: SkipCoachData }) {
  const { best, skipGuesses, curve } = data;
  const thresholdPct = Math.round(best.threshold * 100);
  const scores = curve.map((c) => c.score).concat(data.actualScore);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const pad = Math.max(3, Math.round((hi - lo) * 0.15));
  const xs = curve.map((c) => c.threshold);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;

  if (data.attempts === 0) {
    return (
      <div className="paper-card p-6">
        <p className="margin-note">Answer a few questions first. I need some history before I can tell you what to skip.</p>
      </div>
    );
  }

  return (
    <div className="paper-card relative overflow-hidden p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
        <div className="min-w-0">
          <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">Skip Coach · your last {data.attempts} questions</p>
          <p className="mt-3 text-lg leading-relaxed text-ink sm:text-xl">{data.insight}</p>

          {best.gain > 0 ? (
            <p className="mt-5 text-lg leading-snug text-ink">
              Attempting only above <span className="highlight font-mono font-semibold">{thresholdPct}% mastery</span> would have scored{" "}
              <strong className="font-mono text-2xl text-redpen">{signed(best.gain)}</strong>
              <span className="text-ink-soft"> marks</span>
              {best.skipped > 0 && <span className="text-ink-soft"> (skipping {best.skipped})</span>}.
            </p>
          ) : (
            <p className="mt-5 text-lg leading-snug text-ink">
              Your attempt choices held up: <span className="highlight font-semibold">no mastery cut-off</span> would have beaten your actual score.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip icon={ListChecks}>
              <span className="font-mono">{data.attempts}</span> attempts · score <span className="font-mono">{signed(data.actualScore)}</span>
            </Chip>
            <Chip icon={MinusCircle} tone="red">
              <span className="font-mono">−{data.negativeMarks}</span> lost to wrong MCQs
            </Chip>
            <Chip icon={CircleSlash} tone={skipGuesses.gain > 0 ? "green" : "ink"}>
              Skip your guesses:{" "}
              <span className="font-mono font-semibold">
                {skipGuesses.gain >= 0 ? "+" : ""}
                {skipGuesses.gain}
              </span>
            </Chip>
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-ink/25 bg-paper/60 p-3 text-sm text-ink-soft">
            <p className="font-medium text-ink">Skipping is a skill. CAT punishes confident guesses.</p>
            <p className="mt-1">
              Right answer <span className="font-mono text-mastery-high">+3</span>, wrong MCQ <span className="font-mono text-redpen">−1</span>, wrong TITA{" "}
              <span className="font-mono">0</span>, skip <span className="font-mono">0</span>. Four 25% guesses on MCQs average out to zero; anything worse than
              that is marks thrown away.
            </p>
          </div>
        </div>

        <figure className="min-w-0">
          <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium text-ink">Score if you only attempted above a mastery cut-off</span>
            <span className="flex items-center gap-3 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <svg width="18" height="6" aria-hidden="true">
                  <line x1="0" y1="3" x2="18" y2="3" stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="4 3" />
                </svg>
                actual
              </span>
              <span className="inline-flex items-center gap-1">
                <svg width="14" height="14" aria-hidden="true">
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--redpen)" strokeWidth="1.5" />
                </svg>
                best
              </span>
            </span>
          </figcaption>
          <div className="h-64 w-full sm:h-72" role="img" aria-label={`Line chart: score against mastery cut-off. Actual score ${data.actualScore}. Best is ${best.score} at ${thresholdPct}% mastery.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 16, right: 16, bottom: 18, left: -12 }}>
                <CartesianGrid stroke="var(--ink)" strokeOpacity={0.07} />
                <XAxis
                  type="number"
                  dataKey="threshold"
                  domain={[xMin, xMax]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={14}
                  label={{ value: "attempt only if mastery ≥", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--ink-soft)" }}
                />
                <YAxis
                  domain={[lo - pad, hi + pad]}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <ReferenceLine
                  y={data.actualScore}
                  stroke="var(--ink-soft)"
                  strokeDasharray="5 4"
                  label={{ value: `actual ${signed(data.actualScore)}`, position: "insideBottomLeft", fontSize: 10, fill: "var(--ink-soft)" }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => `attempt if mastery ≥ ${Math.round(Number(v) * 100)}%`}
                  formatter={(v, _n, item) => {
                    const p = item?.payload as { attempted?: number; skipped?: number } | undefined;
                    return [`${signed(Number(v))} (attempt ${p?.attempted ?? "?"}, skip ${p?.skipped ?? "?"})`, "score"];
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--redpen)" }} isAnimationActive={false} />
                <ReferenceDot x={best.threshold} y={best.score} r={12} shape={(p: { cx?: number; cy?: number }) => <RedPenCircle cx={p.cx} cy={p.cy} />} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 font-hand text-xl leading-tight text-redpen">
            ↑ best cut-off: {thresholdPct}% → {signed(best.score)}
          </p>
        </figure>
      </div>
    </div>
  );
}
