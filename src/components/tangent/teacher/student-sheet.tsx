"use client";

import { useEffect, useState } from "react";
import { Check, Flame, X } from "lucide-react";
import type { StudentDrilldown } from "@/lib/api-types";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PenLoader } from "@/components/tangent/pen-loader";
import { StatusChip } from "@/components/tangent/status-chip";
import { cn } from "@/lib/utils";
import { BAND_LABEL, BAND_TEXT, MasteryBar, band, fetchJson, pct, shortDate, useIsDesktop } from "./shared";

type Load =
  | { state: "idle" }
  | { state: "loading"; id: string }
  | { state: "error"; id: string; msg: string }
  | { state: "ok"; id: string; data: StudentDrilldown };

function calibrationText(gap: number | null) {
  if (gap == null) return { text: "Not enough confidence data yet", cls: "text-ink-soft" };
  const pts = Math.round(Math.abs(gap) * (Math.abs(gap) <= 1 ? 100 : 1));
  if (pts <= 5) return { text: "Well calibrated", cls: "text-mastery-high" };
  return gap > 0 ? { text: `Overconfident by ${pts} pts`, cls: "text-redpen" } : { text: `Underconfident by ${pts} pts`, cls: "text-amber-ink" };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-dashed px-5 py-4 last:border-b-0">
      <h3 className="font-serif text-xl text-ink">{title}</h3>
      {children}
    </section>
  );
}

const STATUS_ORDER = { detected: 0, fixing: 1, resolved: 2 } as const;

function Body({ d }: { d: StudentDrilldown }) {
  const cal = calibrationText(d.calibrationGap);
  const [showAll, setShowAll] = useState(false);
  const mis = [...d.misconceptions].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.evidenceCount - a.evidenceCount);
  const misShown = showAll ? mis : mis.slice(0, 6);
  return (
    <>
      <SheetHeader className="gap-1 border-b border-dashed px-5 pt-5 pb-4">
        <p className="font-hand text-xl leading-none text-redpen">{d.archetype ?? "Student"}</p>
        <SheetTitle className="pr-8 font-serif text-3xl leading-tight text-ink">{d.name}</SheetTitle>
        <SheetDescription className="sr-only">Mastery, misconceptions and recent attempts for {d.name}</SheetDescription>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-card px-2 py-1.5">
            <dt className="text-[0.7rem] text-ink-soft">Streak</dt>
            <dd className="flex items-center justify-center gap-1 font-mono text-lg text-ink tabular-nums">
              <Flame className="size-4 text-redpen" aria-hidden="true" />
              {d.streakDays}d
            </dd>
          </div>
          <div className="rounded-lg border bg-card px-2 py-1.5">
            <dt className="text-[0.7rem] text-ink-soft">Target</dt>
            <dd className="font-mono text-lg text-ink tabular-nums">{d.targetPercentile == null ? "—" : `${d.targetPercentile}%ile`}</dd>
          </div>
          <div className="rounded-lg border bg-card px-2 py-1.5">
            <dt className="text-[0.7rem] text-ink-soft">Calibration</dt>
            <dd className={cn("text-xs leading-tight font-medium", cal.cls)}>{cal.text}</dd>
          </div>
        </dl>
      </SheetHeader>

      <Block title="Mastery by area">
        <div className="flex flex-col gap-1.5">
          {d.areas.map((a) => (
            <MasteryBar key={a.area} label={a.area} p={a.mastery} />
          ))}
        </div>
      </Block>

      {d.weakest.length > 0 && (
        <Block title="Weakest concepts">
          <ul className="flex flex-col gap-1">
            {d.weakest.map((w) => (
              <li key={w.conceptId} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink">
                  <span className="font-mono text-xs text-ink-soft">{w.conceptId}</span> {w.name}
                </span>
                <span className={cn("font-mono text-xs tabular-nums", BAND_TEXT[band(w.p)])}>
                  {pct(w.p)} {BAND_LABEL[band(w.p)].toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={`Misconceptions (${mis.length})`}>
        {mis.length === 0 ? (
          <p className="font-hand text-xl text-ink-soft">None caught yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {misShown.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-ink">
                  {m.name}
                  <span className="ml-1.5 font-mono text-xs text-ink-soft">×{m.evidenceCount}</span>
                </span>
                <StatusChip status={m.status} />
              </li>
            ))}
          </ul>
        )}
        {mis.length > 6 && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${mis.length}`}
          </Button>
        )}
      </Block>

      <Block title="Recent attempts">
        {d.recentAttempts.length === 0 ? (
          <p className="text-sm text-ink-soft">No attempts yet.</p>
        ) : (
          <ul className="flex flex-col">
            {d.recentAttempts.map((a, i) => (
              <li key={i} className="ruled-row flex items-start gap-2 py-1.5 text-sm">
                {a.correct ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-mastery-high" aria-label="Correct" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-redpen" aria-label="Wrong" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{a.conceptName}</span>
                  {a.misconceptionName && <span className="block text-sm font-medium leading-tight text-redpen">{a.misconceptionName}</span>}
                </span>
                <span className="shrink-0 text-right font-mono text-[0.7rem] text-ink-soft tabular-nums">
                  {a.timeSec != null && <span className="block">{a.timeSec}s</span>}
                  {shortDate(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

export function StudentSheet({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  const desktop = useIsDesktop();
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!studentId) return;
    let alive = true;
    setLoad({ state: "loading", id: studentId });
    fetchJson<StudentDrilldown>(`/api/teacher/student/${encodeURIComponent(studentId)}`)
      .then((data) => alive && setLoad({ state: "ok", id: studentId, data }))
      .catch((e: unknown) => alive && setLoad({ state: "error", id: studentId, msg: (e as Error).message }));
    return () => {
      alive = false;
    };
  }, [studentId, retry]);

  const side = desktop ? "right" : "bottom";

  return (
    <Sheet open={studentId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={side} className={cn("gap-0 overflow-y-auto bg-paper", side === "right" ? "w-full sm:max-w-md" : "max-h-[88dvh] rounded-t-2xl")}>
        {load.state === "ok" ? (
          <Body key={load.data.id} d={load.data} />
        ) : load.state === "error" ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <SheetTitle className="font-serif text-2xl">Couldn&apos;t open this student</SheetTitle>
            <SheetDescription>{load.msg}</SheetDescription>
            <Button variant="outline" onClick={() => setRetry((r) => r + 1)}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="sr-only">Loading student</SheetTitle>
            <PenLoader label="Opening their notebook…" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
