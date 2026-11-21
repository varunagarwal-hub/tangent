"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, Position, type Edge, type EdgeProps } from "@xyflow/react";
import type { Route } from "./layout";

export type InkFlowEdge = Edge<{ route: Route; span: number; weak: boolean }, "ink">;

/**
 * Ink edge. Adjacent rows: a soft bezier straight down. Row-skipping edges in the same column: an arc out
 * into the margin on the right (wider for longer skips, so nested arcs don't collide). Cross-area: sideways bezier.
 * Weak prerequisite → weak concept: dashed red pen.
 */
function InkEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<InkFlowEdge>) {
  let path: string;
  if (data?.route === "arc") {
    const bulge = 34 + 16 * (data.span ?? 1);
    path = `M ${sourceX} ${sourceY} C ${sourceX + bulge} ${sourceY}, ${targetX + bulge} ${targetY}, ${targetX} ${targetY}`;
  } else {
    [path] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: sourcePosition ?? Position.Bottom,
      targetPosition: targetPosition ?? Position.Top,
    });
  }
  const weak = !!data?.weak;
  return (
    <BaseEdge
      id={id}
      path={path}
      interactionWidth={0}
      style={{
        stroke: weak ? "var(--redpen)" : "var(--ink)",
        strokeOpacity: weak ? 0.85 : 0.3,
        strokeWidth: weak ? 1.8 : 1.4,
        strokeDasharray: weak ? "6 5" : undefined,
        strokeLinecap: "round",
      }}
    />
  );
}

export const InkEdge = memo(InkEdgeImpl);
