"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import type { MapNode } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { band, BAND_LABEL, pctLabel } from "./layout";
import { MasteryRing } from "./mastery-ring";

export const NODE_W = 208;
export const NODE_H = 84;

export type ConceptFlowNode = Node<{ concept: MapNode; due: boolean }, "concept">;

const hidden = "!pointer-events-none !size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";

function ConceptNodeImpl({ data, selected }: NodeProps<ConceptFlowNode>) {
  const n = data.concept;
  const b = band(n.p);
  const weight = Math.max(1, Math.min(3, Math.round(n.weight)));
  const label = `${n.name} (${n.conceptId}): ${n.p == null ? "untested" : `${pctLabel(n.p)} mastery, ${BAND_LABEL[b].toLowerCase()}`}${data.due ? ", due for review" : ""}${n.hasActiveMisconception ? ", active misconception" : ""}`;

  return (
    <div className="relative" style={{ width: NODE_W, height: NODE_H }} aria-label={label} title={label}>
      <Handle type="target" position={Position.Top} id="top" isConnectable={false} className={hidden} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={false} className={hidden} />
      <Handle type="source" position={Position.Right} id="right-s" isConnectable={false} className={hidden} style={{ top: "38%" }} />
      <Handle type="target" position={Position.Right} id="right-t" isConnectable={false} className={hidden} style={{ top: "62%" }} />
      <Handle type="target" position={Position.Left} id="left-t" isConnectable={false} className={hidden} />

      <div
        className={cn(
          "paper-card flex h-full w-full cursor-pointer items-center gap-3 px-3 py-2 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
          b === "unknown" && "border-dashed",
          selected && "ring-2 ring-redpen/60",
        )}
        style={{ opacity: Math.max(0.35, Math.min(1, n.opacity)) }}
      >
        <MasteryRing p={n.p} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-serif text-[0.98rem] leading-[1.1] text-ink">{n.name}</span>
          <span className="flex items-center gap-2 font-mono text-[0.68rem] text-ink-soft">
            <span>{n.conceptId}</span>
            <span aria-hidden="true">·</span>
            <span className={cn(n.p == null && "italic")}>{pctLabel(n.p)}</span>
            <span className="ml-auto flex items-end gap-[2px]" aria-label={`CAT weight ${weight} of 3`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={cn("w-[3px] rounded-full", i <= weight ? "bg-ink/70" : "bg-ink/15")} style={{ height: 4 + i * 2 }} />
              ))}
            </span>
          </span>
        </div>
      </div>

      {n.hasActiveMisconception && (
        <span className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full border-2 border-card bg-redpen" aria-hidden="true" />
      )}
      {data.due && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-(--highlighter-solid) px-1.5 py-px font-mono text-[0.6rem] font-semibold text-[#1b2a4a] shadow-sm">
          <Clock className="size-2.5" aria-hidden="true" />
          due
        </span>
      )}
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeImpl);

export type AreaFlowNode = Node<{ label: string; count: number }, "area">;

/** Column heading that pans and zooms with the graph. */
function AreaNodeImpl({ data }: NodeProps<AreaFlowNode>) {
  return (
    <div className="pointer-events-none flex items-baseline gap-2 border-b border-dashed border-ink/25 pb-1" style={{ width: NODE_W }}>
      <span className="font-serif text-xl text-ink">{data.label}</span>
      <span className="font-mono text-[0.65rem] text-ink-soft">{data.count}</span>
    </div>
  );
}

export const AreaNode = memo(AreaNodeImpl);
