"use client";

import { useMemo } from "react";
import type { MasteryNode } from "@/lib/api-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Band = "low" | "mid" | "high" | "unknown";

export function masteryBand(p: number | null): Band {
  if (p == null) return "unknown";
  if (p < 0.4) return "low";
  if (p <= 0.7) return "mid";
  return "high";
}

const BAND: Record<Band, { label: string; fill: string; ring: string; tint: string }> = {
  low: { label: "Shaky", fill: "bg-mastery-low", ring: "border-mastery-low", tint: "bg-mastery-low/15" },
  mid: { label: "Getting there", fill: "bg-mastery-mid", ring: "border-mastery-mid", tint: "bg-mastery-mid/15" },
  high: { label: "Solid", fill: "bg-mastery-high", ring: "border-mastery-high", tint: "bg-mastery-high/15" },
  unknown: { label: "Untested", fill: "", ring: "border-mastery-unknown border-dashed", tint: "bg-transparent" },
};

/**
 * Compact concept map grouped by area. Each circle fills from the bottom to its mastery level
 * (so the level reads without colour), coloured by band; untested concepts are dashed pencil-gray.
 */
export function MiniMap({ nodes, highlight, className }: { nodes: MasteryNode[]; highlight?: string; className?: string }) {
  const areas = useMemo(() => {
    const map = new Map<string, MasteryNode[]>();
    for (const n of nodes) {
      if (!map.has(n.area)) map.set(n.area, []);
      map.get(n.area)!.push(n);
    }
    return [...map.entries()];
  }, [nodes]);

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] sm:gap-4">
          {areas.map(([area, list]) => (
            <section key={area} aria-label={area} className="flex items-start gap-3 sm:flex-col sm:gap-2">
              <h4 className="w-24 shrink-0 pt-1 font-sans text-xs font-medium tracking-wide text-ink-soft sm:w-auto sm:pt-0" title={area}>
                {area}
              </h4>
              <ul className="flex flex-wrap gap-x-1.5 gap-y-2">
                {list.map((n) => (
                  <li key={n.conceptId}>
                    <MiniNode node={n} highlighted={n.conceptId === highlight} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <Legend />
      </div>
    </TooltipProvider>
  );
}

function MiniNode({ node, highlighted }: { node: MasteryNode; highlighted: boolean }) {
  const band = masteryBand(node.p);
  const b = BAND[band];
  const pct = node.p == null ? null : Math.round(node.p * 100);
  const aria = `${node.name}: ${pct == null ? "not tested yet" : `${pct}% mastery`}${highlighted ? ", current focus" : ""}`;
  const fading = node.opacity < 0.7;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={aria}
            className="group flex w-9 flex-col items-center gap-0.5 rounded-md p-0.5 outline-offset-1"
          />
        }
      >
        <span className="relative block size-7" style={{ opacity: Math.max(0.35, Math.min(1, node.opacity)) }} aria-hidden="true">
          {highlighted && <span className="tg-pulse-ring absolute -inset-1 rounded-full border-2 border-redpen" />}
          {highlighted && <span className="absolute -inset-1 rounded-full border-2 border-redpen/70" />}
          <span className={cn("absolute inset-0 overflow-hidden rounded-full border-2", b.ring, b.tint)}>
            {pct != null && (
              <span
                className={cn("absolute inset-x-0 bottom-0 transition-[height,background-color] duration-700 ease-out motion-reduce:transition-none", b.fill)}
                style={{ height: `${Math.max(8, pct)}%` }}
              />
            )}
          </span>
        </span>
        <span className={cn("font-mono text-[0.65rem] leading-none", highlighted ? "font-bold text-redpen" : "text-ink-soft group-hover:text-ink")}>
          {node.conceptId}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{node.name}</span>
          <span className="font-mono">
            {pct == null ? "Untested" : `${pct}% mastery · ${b.label}`} · {node.attempts} {node.attempts === 1 ? "attempt" : "attempts"}
          </span>
          {fading && <span>Fading: due for review</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function Legend() {
  const items: { band: Band; text: string }[] = [
    { band: "low", text: "< 40% shaky" },
    { band: "mid", text: "40–70% getting there" },
    { band: "high", text: "> 70% solid" },
    { band: "unknown", text: "untested" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft" aria-label="Legend">
      {items.map(({ band, text }) => (
        <li key={band} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-3 rounded-full border-2", BAND[band].ring, BAND[band].fill)} />
          {text}
        </li>
      ))}
    </ul>
  );
}
