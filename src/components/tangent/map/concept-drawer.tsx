"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Check, X } from "lucide-react";
import type { ConceptDetail } from "@/lib/api-types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PenLoader } from "@/components/tangent/pen-loader";
import { cn } from "@/lib/utils";
import { band, BAND_COLOR, BAND_LABEL, dueText, formatSecs, pctLabel } from "./layout";

type Load = { state: "idle" } | { state: "loading"; id: string } | { state: "error"; id: string } | { state: "ok"; id: string; data: ConceptDetail; now: number };

const STATUS: Record<ConceptDetail["misconceptions"][number]["status"], { text: string; cls: string }> = {
  detected: { text: "Detected", cls: "border-redpen/40 bg-redpen/10 text-redpen" },
  fixing: { text: "Fixing", cls: "border-mastery-mid/50 bg-mastery-mid/15 text-amber-ink" },
  resolved: { text: "Resolved · back on the curve", cls: "border-mastery-high/40 bg-mastery-high/12 text-mastery-high" },
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
  fontFamily: "var(--font-jetbrains)",
};

export function ConceptDrawer({ conceptId, onClose, side }: { conceptId: string | null; onClose: () => void; side: "right" | "bottom" }) {
  const [load, setLoad] = useState<Load>({ state: "idle" });

  useEffect(() => {
    if (!conceptId) return;
    const ctrl = new AbortController();
    setLoad({ state: "loading", id: conceptId });
    fetch(`/api/concept/${encodeURIComponent(conceptId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ConceptDetail>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => setLoad({ state: "ok", id: conceptId, data, now: Date.now() }))
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setLoad({ state: "error", id: conceptId });
      });
    return () => ctrl.abort();
  }, [conceptId]);

  return (
    <Sheet open={conceptId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={side}
        className={cn(
          "gap-0 overflow-y-auto bg-paper",
          side === "right" ? "w-full sm:max-w-md" : "max-h-[88dvh] rounded-t-2xl",
        )}
      >
        {load.state === "ok" && load.id === conceptId ? (
          <DrawerBody d={load.data} now={load.now} />
        ) : load.state === "error" ? (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="font-serif text-2xl">Couldn&apos;t open this page</SheetTitle>
            <PenLoader label="The notebook page didn't load. Try again in a moment." className="[&_.tg-squiggle]:animate-none" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="sr-only">Loading concept</SheetTitle>
            <PenLoader label="Flipping to that page…" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ d, now }: { d: ConceptDetail; now: number }) {
  const b = band(d.p);
  const pct = d.p == null ? null : Math.round(d.p * 100);
  const avgSec = d.avgTimeRatio != null ? d.avgTimeRatio * d.targetTimeSec : null;
  const due = dueText(d.dueAt, now);
  const history = d.history.map((h, i) => ({
    i,
    p: h.p,
    label: new Date(h.t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));

  return (
    <>
      <SheetHeader className="gap-1 border-b border-dashed px-5 pt-5 pb-4">
        <p className="font-mono text-xs tracking-wide text-ink-soft">
          {d.conceptId} · {d.area} · weight {d.weight}/3
        </p>
        <SheetTitle className="pr-8 font-serif text-3xl leading-tight text-ink">{d.name}</SheetTitle>
        <SheetDescription className="sr-only">Mastery, history, forgetting curve and misconceptions for {d.name}</SheetDescription>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex flex-col">
            <span className="font-mono text-4xl leading-none" style={{ color: BAND_COLOR[b] }}>
              {pct == null ? (
                <span className="text-2xl text-ink-soft italic">untested</span>
              ) : (
                <>
                  <NumberTicker value={pct} className="tracking-normal text-inherit dark:text-inherit" />%
                </>
              )}
            </span>
            <span className="mt-1 text-xs text-ink-soft">{BAND_LABEL[b]}</span>
          </div>
          <Stat label="attempts" value={String(d.attempts)} />
          <Stat
            label={`avg vs ${formatSecs(d.targetTimeSec)} target`}
            value={formatSecs(avgSec)}
            tone={d.avgTimeRatio != null && d.avgTimeRatio > 1.15 ? "text-redpen" : undefined}
          />
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-5 py-5">
        <Section title="Mastery over time">
          {history.length < 2 ? (
            <p className="margin-note text-lg">Not enough attempts to draw a line yet.</p>
          ) : (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 34, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--ink)" strokeOpacity={0.07} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-soft)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
                  <YAxis domain={[0, 1]} ticks={[0, 0.4, 0.7, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}`} tick={{ fontSize: 10, fill: "var(--ink-soft)" }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0.4} stroke="var(--redpen)" strokeDasharray="4 4" label={{ value: "40", position: "right", fontSize: 10, fill: "var(--redpen)" }} />
                  <ReferenceLine y={0.7} stroke="var(--mastery-high)" strokeDasharray="4 4" label={{ value: "70", position: "right", fontSize: 10, fill: "var(--mastery-high)" }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "var(--ink-soft)" }}
                    formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "mastery"]}
                  />
                  <Line type="monotone" dataKey="p" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3, fill: "var(--paper)", stroke: "var(--ink)" }} activeDot={{ r: 4, fill: "var(--redpen)" }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Forgetting curve" aside={due ? <span className={cn("highlight shrink-0 pr-1 font-hand text-xl", due === "Due now" ? "text-redpen" : "text-ink")}>{due}</span> : null}>
          {d.forgetting.length === 0 || d.dueAt == null ? (
            <p className="text-sm text-ink-soft">No review scheduled yet. Answer a question on this concept to start its memory clock.</p>
          ) : (
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.forgetting} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--ink)" strokeOpacity={0.07} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ink-soft)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} ticks={[0, 7, 14, 21, 30]} tickFormatter={(v: number) => (v === 0 ? "today" : `+${v}d`)} />
                  <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}`} tick={{ fontSize: 10, fill: "var(--ink-soft)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `day +${v}`} formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "recall"]} />
                  <Area type="monotone" dataKey="r" stroke="var(--ink)" strokeWidth={1.8} fill="var(--highlighter)" fillOpacity={1} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-xs text-ink-soft">Chance you&apos;d still recall it, day by day, if you don&apos;t review.</p>
        </Section>

        {d.prerequisites.length > 0 && (
          <Section title="Built on">
            <ul className="flex flex-col gap-1.5">
              {d.prerequisites.map((p) => {
                const pb = band(p.p);
                return (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className={cn("size-2.5 rounded-full border-2", pb === "unknown" && "border-dashed")} style={{ borderColor: BAND_COLOR[pb], background: pb === "unknown" ? "transparent" : BAND_COLOR[pb] }} aria-hidden="true" />
                    <span className="font-mono text-xs text-ink-soft">{p.id}</span>
                    <span className="text-ink">{p.name}</span>
                    <span className="ml-auto font-mono text-xs" style={{ color: pb === "unknown" ? "var(--ink-soft)" : BAND_COLOR[pb] }}>
                      {pctLabel(p.p)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {d.prerequisites.some((p) => p.p != null && p.p < 0.4) && (
              <p className="margin-note mt-2 text-lg">Fix the foundation first.</p>
            )}
          </Section>
        )}

        <Section title="Misconceptions">
          {d.misconceptions.length === 0 ? (
            <p className="text-sm text-ink-soft">None spotted here. Your reasoning has stayed on the curve.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.misconceptions.map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <span className="flex-1 text-ink">
                    {m.name}
                    <span className="ml-1 font-mono text-xs text-ink-soft">×{m.evidenceCount}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium", STATUS[m.status].cls)}>{STATUS[m.status].text}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Last attempts">
          {d.recentAttempts.length === 0 ? (
            <p className="text-sm text-ink-soft">No attempts yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-dashed divide-border">
              {d.recentAttempts.slice(0, 6).map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-center gap-2 py-1.5 text-sm">
                  {a.correct ? (
                    <Check className="size-4 text-mastery-high" aria-label="correct" />
                  ) : (
                    <X className="size-4 text-redpen" aria-label="wrong" />
                  )}
                  <span className="font-mono text-xs text-ink-soft">{new Date(a.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="font-mono text-xs text-ink">{formatSecs(a.timeSec)}</span>
                  {a.misconceptionName && <span className="truncate text-sm font-medium text-redpen">{a.misconceptionName}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Link
          href="/practice"
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
        >
          Practise this <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className={cn("font-mono text-xl leading-none text-ink", tone)}>{value}</span>
      <span className="mt-1 text-xs text-ink-soft">{label}</span>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-xl text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
