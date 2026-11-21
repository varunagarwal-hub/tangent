"use client";

import { useRef } from "react";
import concepts from "../../../data/concepts.json";
import { gsap, useGSAP, MOTION_OK } from "./gsap";

type Concept = { id: string; name: string; prerequisites: string[] };
const BY_ID = new Map((concepts as Concept[]).map((c) => [c.id, c]));

/** Short labels for the mini graph; ids/edges come from data/concepts.json. */
const NODES: { id: string; label: [string, string?]; mastery: number | null; fading?: boolean }[] = [
  { id: "A1", label: ["Percentages"], mastery: 0.31 },
  { id: "A2", label: ["Ratio &", "Proportion"], mastery: 0.78 },
  { id: "A3", label: ["Averages"], mastery: 0.62 },
  { id: "L3", label: ["Linear", "Equations"], mastery: 0.84, fading: true },
  { id: "A4", label: ["Profit &", "Discount"], mastery: 0.28 },
  { id: "A5", label: ["Simple &", "Compound Int."], mastery: 0.46 },
  { id: "A7", label: ["Time &", "Work"], mastery: 0.81 },
  { id: "A8", label: ["Speed &", "Distance"], mastery: 0.38 },
  { id: "A6", label: ["Mixtures"], mastery: 0.55 },
  { id: "L4", label: ["Quadratics"], mastery: null },
];
const START = "A1";

type Layout = { w: number; h: number; r: number; font: number; pos: Record<string, [number, number]> };

const WIDE: Layout = {
  w: 900,
  h: 360,
  r: 26,
  font: 16,
  pos: {
    A1: [120, 80], A2: [430, 80], A3: [650, 80], L3: [830, 80],
    A4: [60, 255], A5: [200, 255], A7: [350, 255], A8: [490, 255], A6: [650, 255], L4: [830, 255],
  },
};
const NARROW: Layout = {
  w: 360,
  h: 560,
  r: 20,
  font: 14,
  pos: {
    A1: [70, 60], A2: [190, 60], A3: [300, 60],
    A4: [40, 200], A5: [130, 200], A6: [300, 200],
    A7: [165, 340], A8: [265, 340],
    L3: [90, 470], L4: [250, 470],
  },
};

const EDGES: [string, string][] = NODES.flatMap((n) =>
  (BY_ID.get(n.id)?.prerequisites ?? []).filter((p) => NODES.some((m) => m.id === p)).map((p) => [p, n.id] as [string, string]),
);

function colorClass(m: number | null) {
  if (m == null) return "fill-mastery-unknown";
  if (m < 0.4) return "fill-mastery-low";
  if (m <= 0.7) return "fill-mastery-mid";
  return "fill-mastery-high";
}

function Graph({ layout, className }: { layout: Layout; className: string }) {
  const { w, h, r, font, pos } = layout;
  const [sx, sy] = pos[START];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label="Mini concept graph: Percentages leads to Profit & Discount and Interest; Ratio leads to Time & Work, Speed & Distance and Mixtures. Percentages is circled: start here.">
      <g fill="none" className="stroke-ink" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round">
        {EDGES.map(([a, b]) => {
          const [x1, y1] = pos[a];
          const [x2, y2] = pos[b];
          const my = (y1 + y2) / 2;
          return <path key={`${a}-${b}`} className="cg-edge" d={`M${x1} ${y1 + r} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2 - r}`} />;
        })}
      </g>
      {NODES.map((n) => {
        const [x, y] = pos[n.id];
        return (
          <g key={n.id} className="cg-node" opacity={n.fading ? 0.55 : 1}>
            <circle cx={x} cy={y} r={r} className="fill-card stroke-mastery-unknown" strokeWidth="2" strokeDasharray={n.mastery == null ? "4 4" : undefined} />
            {n.mastery != null && <circle cx={x} cy={y} r={r - 4} className={`cg-fill ${colorClass(n.mastery)}`} />}
            <text x={x} y={y + 4} textAnchor="middle" className="font-mono fill-paper" fontSize={r > 22 ? 12 : 10} fontWeight="600">
              {n.mastery == null ? "?" : Math.round(n.mastery * 100)}
            </text>
            <text
              x={x}
              y={y + r + font + 4}
              textAnchor="middle"
              className="cg-label font-sans fill-ink"
              fontSize={font}
              paintOrder="stroke"
              strokeWidth="5"
              strokeLinejoin="round"
            >
              <tspan x={x}>{n.label[0]}</tspan>
              {n.label[1] && (
                <tspan x={x} dy={font * 1.15}>
                  {n.label[1]}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
      {/* red pen: start here */}
      <path
        className="cg-ring stroke-redpen"
        d={`M${sx - r - 8} ${sy - 4} C ${sx - r - 6} ${sy - r - 14}, ${sx + r + 12} ${sy - r - 12}, ${sx + r + 10} ${sy + 2} C ${sx + r + 8} ${sy + r + 14}, ${sx - r - 10} ${sy + r + 12}, ${sx - r - 6} ${sy - 10}`}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text className="cg-start font-hand fill-redpen" x={sx + r + 14} y={sy - r - 4} fontSize={r > 22 ? 30 : 24} transform={`rotate(-6 ${sx} ${sy})`}>
        Start here
      </text>
    </svg>
  );
}

export function ConceptGraph() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root);
        gsap.set(q(".cg-fill"), { scale: 0, transformOrigin: "50% 50%" });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: q(".cg-stage")[0], start: "top 75%", once: true },
        });
        tl.from(q(".cg-node"), { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)", stagger: 0.05 })
          .from(q(".cg-edge"), { drawSVG: "0%", duration: 0.7, ease: "power1.inOut", stagger: 0.06 }, "-=0.2")
          .to(q(".cg-fill"), { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.6)", stagger: 0.06 }, "-=0.3")
          .from(q(".cg-ring"), { drawSVG: "0%", duration: 0.8, ease: "power1.inOut" }, "-=0.1")
          .from(q(".cg-start"), { autoAlpha: 0, x: -8, duration: 0.4 }, "-=0.2");
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="mt-28 sm:mt-36" aria-labelledby="graph-title">
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="font-hand text-2xl text-redpen">the concept graph</p>
          <h2 id="graph-title" className="mt-1 text-4xl text-ink sm:text-5xl">
            Fix the root, <span className="hand-underline">not the symptom</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Struggling with discounts is often a percentages problem in disguise. Tangent maps 27 CAT Quant concepts and
            their prerequisites, so your plan starts where the curve actually bent.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-mastery-low" />shaky</li>
            <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-mastery-mid" />getting there</li>
            <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-mastery-high" />solid</li>
            <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-dashed border-mastery-unknown" />untested</li>
            <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-mastery-high opacity-50" />fading, due for review</li>
          </ul>
        </div>
        <div className="cg-stage paper-card graph-paper p-4 sm:p-6">
          <Graph layout={WIDE} className="hidden h-auto w-full sm:block" />
          <Graph layout={NARROW} className="mx-auto block h-auto w-full max-w-sm sm:hidden" />
        </div>
      </div>
    </section>
  );
}
