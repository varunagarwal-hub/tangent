"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Crosshair } from "lucide-react";
import type { CalibrationData } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
};

const pctOf = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

type Verdict = { kind: "over" | "under" | "ok" | "none"; text: string };

function verdict(gap: number | null, n: number): Verdict {
  if (gap == null || n === 0) return { kind: "none", text: "No rated answers yet" };
  const pts = Math.round(Math.abs(gap) * 100);
  if (gap > 0.1) return { kind: "over", text: `Overconfident by ${pts} pts` };
  if (gap < -0.1) return { kind: "under", text: `Underconfident by ${pts} pts` };
  return { kind: "ok", text: pts === 0 ? "Well calibrated" : `Well calibrated (±${pts} pts)` };
}

const VERDICT_CLS: Record<Verdict["kind"], string> = {
  over: "text-redpen",
  under: "text-amber-ink",
  ok: "text-mastery-high",
  none: "text-ink-soft",
};
const VERDICT_MARK: Record<Verdict["kind"], string> = { over: "▲", under: "▼", ok: "✓", none: "·" };
const VERDICT_STROKE: Record<Verdict["kind"], string> = {
  over: "bg-redpen",
  under: "bg-mastery-mid",
  ok: "bg-mastery-high",
  none: "bg-ink/20",
};

/** Paired bars per confidence level: how sure you felt vs how often you were right. */
function ReliabilityChart({ rows }: { rows: CalibrationData["byConfidence"] }) {
  const data = rows.map((r) => ({ label: r.label, felt: r.expected, right: r.accuracy ?? 0, has: r.accuracy != null, n: r.n }));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="tg-felt-swatch inline-block size-3 rounded-sm border border-ink/50" aria-hidden="true" />
          how sure you felt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-ink" aria-hidden="true" />
          how often you were right
        </span>
      </figcaption>
      <div className="h-60 w-full" role="img" aria-label="Paired bar chart of confidence versus accuracy for each confidence level">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: -18 }} barGap={4} barCategoryGap="22%">
            <defs>
              <pattern id="tg-felt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--card)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-soft)" strokeWidth="2" strokeOpacity="0.55" />
              </pattern>
            </defs>
            <CartesianGrid stroke="var(--ink)" strokeOpacity={0.07} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}`} tick={{ fontSize: 10, fill: "var(--ink-soft)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--ink)", fillOpacity: 0.05 }}
              formatter={(v, name, item) => {
                const p = item?.payload as { has: boolean; n: number } | undefined;
                if (name === "right" && !p?.has) return ["no answers yet", "right"];
                return [`${Math.round(Number(v) * 100)}%${name === "right" ? ` of ${p?.n ?? 0}` : ""}`, name === "felt" ? "felt" : "right"];
              }}
            />
            <Bar dataKey="felt" fill="url(#tg-felt-hatch)" stroke="var(--ink-soft)" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="felt" position="top" formatter={(v: unknown) => `${Math.round(Number(v) * 100)}`} style={{ fontSize: 10, fill: "var(--ink-soft)", fontFamily: "var(--font-jetbrains)" }} />
            </Bar>
            <Bar dataKey="right" fill="var(--ink)" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="right" position="top" formatter={(v: unknown) => `${Math.round(Number(v) * 100)}`} style={{ fontSize: 10, fill: "var(--ink)", fontFamily: "var(--font-jetbrains)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((r) => {
          const v = verdict(r.accuracy == null ? null : r.expected - r.accuracy, r.n);
          return (
            <li key={r.level} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{r.label}:</span>
              <span className="text-ink-soft">
                right <span className="font-mono text-ink">{pctOf(r.accuracy)}</span> of <span className="font-mono">{r.n}</span>
              </span>
              <span className={cn("text-xs", VERDICT_CLS[v.kind])}>
                <span aria-hidden="true">{VERDICT_MARK[v.kind]} </span>
                {v.text}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Dumbbell per area: ○ confidence, ● accuracy on one 0–100 track. */
function AreaRow({ row }: { row: CalibrationData["byArea"][number] }) {
  const v = verdict(row.gap, row.n);
  const c = row.avgConfidence;
  const a = row.accuracy;
  const lo = c != null && a != null ? Math.min(c, a) : null;
  const hi = c != null && a != null ? Math.max(c, a) : null;
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_11rem] sm:items-center">
      <span className="flex items-baseline justify-between gap-2 text-sm text-ink sm:block">
        <span className="font-medium">{row.area}</span>
        <span className="font-mono text-xs text-ink-soft sm:ml-2">n={row.n}</span>
      </span>
      <div className="relative h-6" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/15" />
        {[0.25, 0.5, 0.75].map((t) => (
          <div key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/15" style={{ left: `${t * 100}%` }} />
        ))}
        {lo != null && hi != null && (
          <div className={cn("absolute top-1/2 h-1 -translate-y-1/2 rounded-full", VERDICT_STROKE[v.kind])} style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
        )}
        {c != null && (
          <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-card" style={{ left: `${c * 100}%` }} />
        )}
        {a != null && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${a * 100}%` }} />}
      </div>
      <span className={cn("text-sm", VERDICT_CLS[v.kind])}>
        <span aria-hidden="true">{VERDICT_MARK[v.kind]} </span>
        {v.text}
        {v.kind !== "none" && (
          <span className="block text-xs text-ink-soft">
            felt <span className="font-mono">{pctOf(c)}</span> · right <span className="font-mono">{pctOf(a)}</span>
          </span>
        )}
        <span className="sr-only">{v.kind !== "none" ? ` in ${row.area}` : ""}</span>
      </span>
    </li>
  );
}

export function Calibration({ data }: { data: CalibrationData }) {
  const ov = verdict(data.overall.gap, data.byConfidence.reduce((s, r) => s + r.n, 0));
  const areas = [...data.byArea].sort((x, y) => (y.gap ?? -9) - (x.gap ?? -9));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="paper-card min-w-0 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl">Do you know what you know?</h3>
          <span className={cn("text-sm", VERDICT_CLS[ov.kind])}>
            Overall: <span aria-hidden="true">{VERDICT_MARK[ov.kind]} </span>
            {ov.text}
          </span>
        </div>
        <ReliabilityChart rows={data.byConfidence} />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="paper-card min-w-0 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl">Confidence vs accuracy, by area</h3>
            <span className="flex items-center gap-3 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-3 rounded-full border-2 border-ink bg-card" aria-hidden="true" />
                felt
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full bg-ink" aria-hidden="true" />
                right
              </span>
            </span>
          </div>
          <ul className="mt-2 divide-y divide-dashed divide-ink/15">
            {areas.map((r) => (
              <AreaRow key={r.area} row={r} />
            ))}
          </ul>
        </div>

        <div className="paper-card flex items-center gap-4 border-redpen/30 p-5">
          <div className="relative grid size-16 shrink-0 place-items-center">
            <Crosshair className="absolute size-16 text-redpen/25" strokeWidth={1.25} aria-hidden="true" />
            <span className="font-mono text-3xl font-semibold text-redpen tabular-nums">{data.confidentlyWrong}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {data.confidentlyWrong === 1 ? "1 answer" : `${data.confidentlyWrong} answers`} marked “Certain” turned out wrong
            </p>
            <p className="margin-note mt-0.5 text-xl">Certain and wrong: the misconceptions worth fixing first.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
