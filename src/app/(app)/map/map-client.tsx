"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Controls, Panel, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import { Clock, Maximize2 } from "lucide-react";
import type { MapData } from "@/lib/api-types";
import { PenLoader } from "@/components/tangent/pen-loader";
import { Button } from "@/components/ui/button";
import { AreaNode, ConceptNode, NODE_H, NODE_W, type AreaFlowNode, type ConceptFlowNode } from "@/components/tangent/map/concept-node";
import { InkEdge, type InkFlowEdge } from "@/components/tangent/map/ink-edge";
import { ConceptDrawer } from "@/components/tangent/map/concept-drawer";
import { AREAS, isDue, layoutMap, summarize } from "@/components/tangent/map/layout";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/tangent/page-intro";
import { InfoTip } from "@/components/tangent/info-tip";

const COL_PITCH = NODE_W + 120;
const ROW_PITCH = NODE_H + 34;
const HEADER_H = 56;

const nodeTypes = { concept: ConceptNode, area: AreaNode };

type AppNode = ConceptFlowNode | AreaFlowNode;
const edgeTypes = { ink: InkEdge };

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 640px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true,
  );
}

export function MapClient() {
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(() => {
    setError(false);
    fetch("/api/map")
      .then((r) => (r.ok ? (r.json() as Promise<MapData>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setNow(Date.now());
        setData(d);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => (data ? summarize(data.nodes, now) : null), [data, now]);

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        id="map"
        steps={[
          "Each card is a CAT Quant concept; arrows point from a foundation to what's built on it.",
          "The ring and colour show your mastery. Faded cards are due for review; a red dot is an active mistake.",
          "Tap a concept for its history, forgetting curve and mistakes.",
        ]}
      />
      <header className="flex flex-col gap-3">
        <h1 className="flex items-center gap-2 self-start text-4xl text-ink sm:text-5xl"><span className="hand-underline">Your Mastery Map</span> <InfoTip term="masteryScale" /></h1>
        <p className="max-w-2xl text-sm text-ink-soft sm:text-base">
          Every CAT Quant concept, wired to what it&apos;s built on. Tap a concept to see how it&apos;s going, and when you&apos;ll start to forget it.
        </p>
        {counts && (
          <ul className="flex flex-wrap gap-2 font-mono text-xs" aria-label="Summary">
            <Chip dot="bg-mastery-high">{counts.solid} solid</Chip>
            {counts.mid > 0 && <Chip dot="bg-mastery-mid">{counts.mid} getting there</Chip>}
            <Chip dot="bg-mastery-low">{counts.shaky} shaky</Chip>
            <Chip dot="border-2 border-dashed border-mastery-unknown">{counts.untested} untested</Chip>
            <Chip icon>{counts.due} due</Chip>
          </ul>
        )}
      </header>

      <div className="paper-card relative h-[68dvh] min-h-[440px] overflow-hidden bg-transparent sm:h-[72dvh]">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <PenLoader label="The map didn't load." className="[&_.tg-squiggle]:animate-none [&_.tg-pen]:animate-none" />
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        ) : !data ? (
          <div className="flex h-full items-center justify-center">
            <PenLoader label="Drawing your map…" />
          </div>
        ) : (
          <ReactFlowProvider>
            <Graph data={data} now={now} />
          </ReactFlowProvider>
        )}
      </div>

      <Legend />
    </div>
  );
}

function Graph({ data, now }: { data: MapData; now: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const desktop = useIsDesktop();

  const { nodes, edges } = useMemo(() => {
    const { slots, edges: routed } = layoutMap(data);
    const conceptNodes: ConceptFlowNode[] = data.nodes.flatMap((n) => {
      const s = slots.get(n.conceptId);
      if (!s) return [];
      return [
        {
          id: n.conceptId,
          type: "concept" as const,
          position: { x: s.col * COL_PITCH, y: HEADER_H + s.row * ROW_PITCH },
          data: { concept: n, due: isDue(n, now) },
          draggable: false,
          connectable: false,
          width: NODE_W,
          height: NODE_H,
          ariaLabel: `${n.name}, open details`,
        },
      ];
    });
    const edges: InkFlowEdge[] = routed.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: "ink" as const,
      sourceHandle: e.route === "down" ? "bottom" : "right-s",
      targetHandle: e.route === "down" ? "top" : e.route === "arc" ? "right-t" : "left-t",
      data: { route: e.route, span: e.span, weak: e.weakFoundation },
      selectable: false,
      focusable: false,
    }));
    const areas = [...new Set<string>([...AREAS, ...data.nodes.map((n) => n.area)])];
    const headings: AreaFlowNode[] = areas.flatMap((label, col) => {
      const count = data.nodes.filter((n) => n.area === label).length;
      if (count === 0) return [];
      return [
        {
          id: `area-${col}`,
          type: "area" as const,
          position: { x: col * COL_PITCH, y: 0 },
          data: { label, count },
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
          width: NODE_W,
          height: 32,
        },
      ];
    });
    const nodes: AppNode[] = [...headings, ...conceptNodes];
    return { nodes, edges };
  }, [data, now]);

  const onNodeClick: NodeMouseHandler<AppNode> = useCallback((_, node) => {
    if (node.type === "concept") setSelected(node.id);
  }, []);

  return (
    <>
      <ReactFlow<AppNode, InkFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.15}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        className="tg-flow"
        aria-label="Concept mastery graph"
      >
        <Controls showInteractive={false} position="bottom-left" />
        <FitButton />
      </ReactFlow>
      <ConceptDrawer conceptId={selected} onClose={() => setSelected(null)} side={desktop ? "right" : "bottom"} />
    </>
  );
}

function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <Panel position="top-right">
      <Button variant="outline" size="sm" onClick={() => fitView({ padding: 0.08, duration: 400 })} className="bg-card shadow-sm">
        <Maximize2 aria-hidden="true" />
        Fit
      </Button>
    </Panel>
  );
}

function Chip({ children, dot, icon }: { children: React.ReactNode; dot?: string; icon?: boolean }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-ink">
      {icon ? <Clock className="size-3 text-ink-soft" aria-hidden="true" /> : <span className={cn("size-2.5 rounded-full", dot)} aria-hidden="true" />}
      {children}
    </li>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft" aria-label="Legend">
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-mastery-low" aria-hidden="true" /> under 40% · shaky
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-mastery-mid" aria-hidden="true" /> 40–70% · getting there
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-mastery-high" aria-hidden="true" /> over 70% · solid
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-dashed border-mastery-unknown" aria-hidden="true" /> untested
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded-sm border bg-card opacity-40" aria-hidden="true" /> faded = due for review
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-redpen" aria-hidden="true" /> red dot = active misconception
      </li>
      <li className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden="true">
          <path d="M1 3 H21" stroke="var(--redpen)" strokeWidth="1.8" strokeDasharray="5 4" />
        </svg>
        dashed red = fix the foundation first
      </li>
    </ul>
  );
}
