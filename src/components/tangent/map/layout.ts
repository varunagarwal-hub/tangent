import type { MapData, MapNode } from "@/lib/api-types";

export const AREAS = ["Arithmetic", "Number System", "Algebra", "Geometry", "Modern Math"] as const;

export type Band = "low" | "mid" | "high" | "unknown";

/** Same banding as the mini-map: <0.4 low, 0.4–0.7 mid, >0.7 high, null untested. */
export function band(p: number | null): Band {
  if (p == null) return "unknown";
  if (p < 0.4) return "low";
  if (p <= 0.7) return "mid";
  return "high";
}

export const BAND_COLOR: Record<Band, string> = {
  low: "var(--mastery-low)",
  mid: "var(--mastery-mid)",
  high: "var(--mastery-high)",
  unknown: "var(--mastery-unknown)",
};

export const BAND_LABEL: Record<Band, string> = {
  low: "Shaky",
  mid: "Getting there",
  high: "Solid",
  unknown: "Untested",
};

export function pctLabel(p: number | null): string {
  return p == null ? "untested" : `${Math.round(p * 100)}%`;
}

export function isWeak(p: number | null): boolean {
  return p != null && p < 0.4;
}

export interface Slot {
  col: number;
  row: number;
}

export type Route = "down" | "arc" | "cross";

export interface RoutedEdge {
  id: string;
  from: string;
  to: string;
  route: Route;
  /** rows skipped for same-column arcs (0 for adjacent) */
  span: number;
  /** a weak prerequisite feeding a weak concept: "fix the foundation first" */
  weakFoundation: boolean;
}

/**
 * Deterministic column layout: one column per area, nodes ordered by a depth-first topological walk
 * (a prerequisite always sits above its dependents and children follow their parent closely, so most
 * edges are short). Edges between adjacent rows go straight down; ones that skip rows arc out to the
 * right of the column; cross-area edges go sideways.
 */
export function layoutMap(data: MapData): { slots: Map<string, Slot>; edges: RoutedEdge[]; rows: number } {
  const byId = new Map(data.nodes.map((n) => [n.conceptId, n]));
  const slots = new Map<string, Slot>();
  let rows = 0;

  const areas = [...AREAS, ...new Set(data.nodes.map((n) => n.area).filter((a) => !(AREAS as readonly string[]).includes(a)))];

  areas.forEach((area, col) => {
    const list = data.nodes.filter((n) => n.area === area).sort((a, b) => a.conceptId.localeCompare(b.conceptId, undefined, { numeric: true }));
    const inArea = new Set(list.map((n) => n.conceptId));
    const localPrereqs = (n: MapNode) => n.prerequisites.filter((p) => inArea.has(p));
    const emitted: string[] = [];
    const done = new Set<string>();

    const visit = (n: MapNode) => {
      done.add(n.conceptId);
      emitted.push(n.conceptId);
      for (const child of list) {
        if (done.has(child.conceptId)) continue;
        const pre = localPrereqs(child);
        if (pre.includes(n.conceptId) && pre.every((p) => done.has(p))) visit(child);
      }
    };
    // roots first (in id order), then anything left (e.g. cycles, which shouldn't exist)
    for (const n of list) if (!done.has(n.conceptId) && localPrereqs(n).length === 0) visit(n);
    for (const n of list) if (!done.has(n.conceptId)) visit(n);

    emitted.forEach((id, row) => slots.set(id, { col, row }));
    rows = Math.max(rows, emitted.length);
  });

  const edges: RoutedEdge[] = [];
  for (const e of data.edges) {
    const a = slots.get(e.from);
    const b = slots.get(e.to);
    if (!a || !b) continue;
    const src = byId.get(e.from)!;
    const dst = byId.get(e.to)!;
    let route: Route = "cross";
    let span = 0;
    if (a.col === b.col) {
      span = b.row - a.row - 1;
      route = span <= 0 ? "down" : "arc";
    }
    edges.push({
      id: `${e.from}-${e.to}`,
      from: e.from,
      to: e.to,
      route,
      span: Math.max(0, span),
      weakFoundation: isWeak(src.p) && isWeak(dst.p),
    });
  }
  return { slots, edges, rows };
}

/** The concept to start with: the weakest tested concept among the highest-weight ones. */
export function pickStartHere(nodes: MapNode[]): MapNode | null {
  const tested = nodes.filter((n) => n.p != null);
  if (tested.length === 0) return null;
  const maxW = Math.max(...tested.map((n) => n.weight));
  const pool = tested.filter((n) => n.weight === maxW && (n.p as number) < 0.7);
  const list = pool.length ? pool : tested;
  return [...list].sort((a, b) => (a.p as number) - (b.p as number) || b.weight - a.weight)[0];
}

export function isDue(n: { dueAt: string | null }, now: number): boolean {
  return n.dueAt != null && new Date(n.dueAt).getTime() <= now;
}

export function summarize(nodes: MapNode[], now: number) {
  let solid = 0,
    mid = 0,
    shaky = 0,
    untested = 0,
    due = 0;
  for (const n of nodes) {
    const b = band(n.p);
    if (b === "high") solid++;
    else if (b === "mid") mid++;
    else if (b === "low") shaky++;
    else untested++;
    if (isDue(n, now)) due++;
  }
  return { solid, mid, shaky, untested, due };
}

export function formatSecs(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return "–";
  const r = Math.round(s);
  if (r < 60) return `${r}s`;
  return `${Math.floor(r / 60)}m ${String(r % 60).padStart(2, "0")}s`;
}

/** "Due now", "Due in 3 days", "Due tomorrow", or null when nothing is scheduled. */
export function dueText(dueAt: string | null, now: number): string | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  if (ms <= 0) return "Due now";
  const hours = ms / 36e5;
  if (hours < 24) return `Due in ${Math.max(1, Math.round(hours))}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}
