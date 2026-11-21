"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Clock, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(Math.min(m, 99)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** mm:ss stopwatch. Amber past target, red pen past 1.5× target. Fixed width, no layout shift. */
export function Timer({ startedAt, targetSec, stopped = false }: { startedAt: number; targetSec: number; stopped?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    if (stopped) return;
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [startedAt, stopped]);

  const state = elapsed > targetSec * 1.5 ? "over" : elapsed > targetSec ? "past" : "ok";
  const Icon = state === "over" ? AlarmClock : state === "past" ? TriangleAlert : Clock;
  const explain =
    state === "over"
      ? `Over 1.5× the target time (${fmt(targetSec)}). Consider making your best attempt and moving on.`
      : state === "past"
        ? `Past the target time of ${fmt(targetSec)} for this question.`
        : `Target time: ${fmt(targetSec)}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="timer"
              aria-label={`Time ${fmt(elapsed)}${stopped ? ", stopped" : ""}. ${explain}`}
              className={cn(
                "inline-flex w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 py-1 font-mono text-sm tabular-nums transition-colors",
                state === "ok" && "border-border text-ink",
                state === "past" && "border-current text-amber-ink",
                state === "over" && "border-current bg-redpen/10 text-redpen",
              )}
            />
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span aria-hidden="true">{fmt(elapsed)}</span>
        </TooltipTrigger>
        <TooltipContent>{explain}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
