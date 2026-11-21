import type { MapData, MapNode } from "@/lib/api-types";
import { AREAS, band, BAND_COLOR, layoutMap, pctLabel } from "./layout";

const COL = 150;
const ROW = 74;
const NOTE_BAND = 46;
const TOP = 58 + NOTE_BAND;
const R = 20;
const PAD_X = 75;

export interface RevealGeometry {
  width: number;
  height: number;
  pos: Map<string, { x: number; y: number }>;
}

export function revealGeometry(data: MapData): RevealGeometry & { layout: ReturnType<typeof layoutMap> } {
  const layout = layoutMap(data);
  const pos = new Map<string, { x: number; y: number }>();
  let cols = 0;
  for (const [id, s] of layout.slots) {
    pos.set(id, { x: PAD_X + s.col * COL, y: TOP + s.row * ROW });
    cols = Math.max(cols, s.col + 1);
  }
  return { width: PAD_X * 2 + (cols - 1) * COL + 20, height: TOP + (layout.rows - 1) * ROW + 44, pos, layout };
}

/** Hand-drawn, slightly-overshooting loop around (cx, cy), like a mentor circling something in red pen. */
export function handCircle(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${cx - rx} ${cy + 4}`,
    `C ${cx - rx} ${cy - ry * 1.15}, ${cx + rx * 1.1} ${cy - ry * 1.05}, ${cx + rx} ${cy + 2}`,
    `C ${cx + rx * 0.95} ${cy + ry * 1.12}, ${cx - rx * 1.05} ${cy + ry * 1.05}, ${cx - rx * 1.03} ${cy - 2}`,
    `C ${cx - rx} ${cy - ry * 0.6}, ${cx - rx * 0.5} ${cy - ry * 1.12}, ${cx - rx * 0.05} ${cy - ry * 1.16}`,
  ].join(" ");
}

/**
 * The reveal's own SVG rendering of the concept graph (not React Flow, so DrawSVG can animate the strokes).
 * Class hooks for the GSAP timeline: rv-area, rv-edge, rv-node, rv-fill, rv-label, rv-circle.
 */
export function RevealGraph({ data, geo, start }: { data: MapData; geo: ReturnType<typeof revealGeometry>; start: MapNode | null }) {
  const { pos, layout, width, height } = geo;
  const areas = [...new Set<string>([...AREAS, ...data.nodes.map((n) => n.area)])];
  const startPos = start ? pos.get(start.conceptId) : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Your concept mastery graph">
      {areas.map((a, col) =>
        data.nodes.some((n) => n.area === a) ? (
          <text key={a} x={PAD_X + col * COL} y={NOTE_BAND + 18} textAnchor="middle" className="rv-area font-serif" fontSize={17} fill="var(--ink)">
            {a}
          </text>
        ) : null,
      )}

      <g fill="none" strokeLinecap="round">
        {layout.edges.map((e) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          let d: string;
          if (e.route === "down") {
            const y1 = a.y + R;
            const y2 = b.y - R;
            const m = (y2 - y1) / 2;
            d = `M ${a.x} ${y1} C ${a.x} ${y1 + m}, ${b.x} ${y2 - m}, ${b.x} ${y2}`;
          } else if (e.route === "arc") {
            const bulge = 26 + 12 * e.span;
            d = `M ${a.x + R * 0.8} ${a.y + 6} C ${a.x + R + bulge} ${a.y + 6}, ${b.x + R + bulge} ${b.y - 6}, ${b.x + R * 0.8} ${b.y - 6}`;
          } else {
            const x1 = a.x + R;
            const x2 = b.x - R;
            const m = (x2 - x1) / 2;
            d = `M ${x1} ${a.y} C ${x1 + m} ${a.y}, ${x2 - m} ${b.y}, ${x2} ${b.y}`;
          }
          return (
            <path
              key={e.id}
              d={d}
              className="rv-edge"
              stroke={e.weakFoundation ? "var(--redpen)" : "var(--ink)"}
              strokeOpacity={e.weakFoundation ? 0.8 : 0.32}
              strokeWidth={e.weakFoundation ? 2 : 1.5}
            />
          );
        })}
      </g>

      {data.nodes.map((n) => {
        const p = pos.get(n.conceptId);
        if (!p) return null;
        const b = band(n.p);
        const untested = b === "unknown";
        return (
          <g key={n.conceptId} transform={`translate(${p.x} ${p.y})`}>
            <title>{`${n.name}: ${untested ? "untested" : `${pctLabel(n.p)} mastery`}`}</title>
            <g className="rv-node">
              <circle
                r={R}
                fill="var(--card)"
                stroke={BAND_COLOR[b]}
                strokeWidth={untested ? 1.6 : 2}
                strokeDasharray={untested ? "4 3" : undefined}
              />
              {!untested && <circle className="rv-fill" r={R - 3.5} fill={BAND_COLOR[b]} />}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className="font-mono"
                fontSize={11}
                fontWeight={700}
                fill={untested ? "var(--ink-soft)" : "var(--paper)"}
              >
                {n.conceptId}
              </text>
              {n.hasActiveMisconception && <circle cx={R * 0.72} cy={-R * 0.72} r={4} fill="var(--redpen)" stroke="var(--paper)" strokeWidth={1.5} />}
            </g>
            <text
              className="rv-label font-mono"
              y={R + 13}
              textAnchor="middle"
              fontSize={11}
              fill={untested ? "var(--ink-soft)" : "var(--ink)"}
              fontStyle={untested ? "italic" : undefined}
            >
              {untested ? "untested" : pctLabel(n.p)}
            </text>
          </g>
        );
      })}

      {startPos && (
        <path
          className="rv-circle"
          d={handCircle(startPos.x, startPos.y + 6, R + 17, R + 18)}
          fill="none"
          stroke="var(--redpen)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      )}
      {startPos && (
        <path
          className="rv-arrow"
          d={`M ${startPos.x + 56} ${NOTE_BAND - 8} C ${startPos.x + 62} ${NOTE_BAND + 30}, ${startPos.x + R + 26} ${startPos.y - R - 16}, ${startPos.x + R + 8} ${startPos.y - R - 4} M ${startPos.x + R + 8} ${startPos.y - R - 4} l 9 -2 M ${startPos.x + R + 8} ${startPos.y - R - 4} l 1 -9`}
          fill="none"
          stroke="var(--redpen)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export const REVEAL_R = R;
export const REVEAL_NOTE_BAND = NOTE_BAND;
