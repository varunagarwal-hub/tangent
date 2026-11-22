"use client";

/**
 * Guided-demo + welcome-tour plumbing: window events and tolerant localStorage helpers.
 * Pages call `markDemoStep("redpen")` etc. when a step happens; the floating DemoGuide ticks it off.
 */

export const DEMO_EVENT = "tangent:demo";
export const DEMO_OPEN_EVENT = "tangent:demo-open";
export const TOUR_OPEN_EVENT = "tangent:tour-open";

export const LS = {
  tourSeen: "tangent:tour-seen",
  demoActive: "tangent:demo-active",
  demoDone: "tangent:demo-done",
  demoCollapsed: "tangent:demo-collapsed",
  demoLastTick: "tangent:demo-last-tick",
} as const;

export type DemoStepId =
  | "today"
  | "redpen"
  | "map"
  | "mistakes"
  | "learn"
  | "spot"
  | "mock"
  | "strategy"
  | "teacher"
  | "lesson"
  | "uth";

/** Tick a guided-demo step (no-op if the guide isn't running). */
export function markDemoStep(step: DemoStepId | string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail: { step } }));
}

/** Open (and start) the guided demo checklist. */
export function openDemoGuide() {
  if (typeof window === "undefined") return;
  lsSet(LS.demoActive, "1");
  lsSet(LS.demoCollapsed, "0");
  window.dispatchEvent(new CustomEvent(DEMO_OPEN_EVENT));
}

/** Open the welcome tour (role picker). */
export function openTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_OPEN_EVENT));
}

export const STORE_EVENT = "tangent:demo-store";
// In-memory fallback so the guide still works when storage is blocked (it just won't survive a reload).
const memory = new Map<string, string>();

export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function lsSet(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage: the UI still works, it just won't remember */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

/** useSyncExternalStore plumbing for the demo guide's persisted state. */
export function subscribeDemoStore(cb: () => void) {
  window.addEventListener(STORE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(STORE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
export interface DemoStoreState {
  active: boolean;
  collapsed: boolean;
  done: string[];
  /** "<step>@<ms>" of the most recent tick, for the brief "✓ step" flash */
  lastTick: string;
}

/** A primitive (string) snapshot, so useSyncExternalStore compares by value. Parse with parseDemoStore. */
export function demoStoreSnapshot() {
  return JSON.stringify({
    active: lsGet(LS.demoActive) === "1",
    collapsed: lsGet(LS.demoCollapsed) === "1",
    done: getDone(),
    lastTick: lsGet(LS.demoLastTick) ?? "",
  } satisfies DemoStoreState);
}

export function parseDemoStore(snap: string): DemoStoreState | null {
  if (!snap) return null;
  try {
    return JSON.parse(snap) as DemoStoreState;
  } catch {
    return null;
  }
}

/** Tick a step (only while the guide is running); collapses the guide to its pill with a brief "✓" flash. */
export function tickDemoStep(step: string) {
  if (lsGet(LS.demoActive) !== "1") return;
  const done = getDone();
  if (done.includes(step)) return;
  lsSet(LS.demoLastTick, `${step}@${Date.now()}`);
  lsSet(LS.demoCollapsed, "1");
  lsSet(LS.demoDone, JSON.stringify([...done, step]));
}

export function getDone(): string[] {
  try {
    const v = JSON.parse(lsGet(LS.demoDone) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function setPersona(persona: "riya" | "mehta" | "new") {
  await fetch("/api/persona", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona }) });
}
