"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Band = "low" | "mid" | "high" | "unknown";

/** <0.4 low, 0.4–0.7 mid, >0.7 high, null untested (same as the map). */
export function band(p: number | null | undefined): Band {
  if (p == null) return "unknown";
  if (p < 0.4) return "low";
  if (p <= 0.7) return "mid";
  return "high";
}

export const BAND_LABEL: Record<Band, string> = {
  low: "Shaky",
  mid: "Getting there",
  high: "Solid",
  unknown: "Untested",
};

export const BAND_SHORT: Record<Band, string> = { low: "shaky", mid: "fair", high: "solid", unknown: "untested" };

export const BAND_BG: Record<Band, string> = {
  low: "bg-mastery-low",
  mid: "bg-mastery-mid",
  high: "bg-mastery-high",
  unknown: "tg-hatch",
};

export const BAND_TEXT: Record<Band, string> = {
  low: "text-redpen",
  mid: "text-amber-ink",
  high: "text-mastery-high",
  unknown: "text-ink-soft",
};

export function pct(p: number | null | undefined): string {
  return p == null ? "—" : `${Math.round(p * 100)}%`;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const j = (await r.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function useIsDesktop() {
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

/** Dates are formatted only in effects/handlers or after data arrives (never during SSR). */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SectionHeading({
  kicker,
  title,
  aside,
  id,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        {kicker && <p className="font-hand text-lg leading-none text-redpen">{kicker}</p>}
        <h2 id={id} className="hand-underline mt-1 text-2xl text-ink sm:text-3xl">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/** Thin horizontal mastery bar with a % label (never colour alone). */
export function MasteryBar({ p, label, className }: { p: number | null; label?: string; className?: string }) {
  const b = band(p);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="w-28 shrink-0 truncate text-sm text-ink">{label}</span>}
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        {p == null ? (
          <div className="tg-hatch absolute inset-0" />
        ) : (
          <div className={cn("absolute inset-y-0 left-0 rounded-full", BAND_BG[b])} style={{ width: `${Math.max(3, Math.round(p * 100))}%` }} />
        )}
      </div>
      <span className={cn("w-[4.75rem] shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums", BAND_TEXT[b])} aria-hidden="true">
        {p == null ? "untested" : `${pct(p)} ${BAND_SHORT[b]}`}
      </span>
      <span className="sr-only">{label ? `${label}: ` : ""}{p == null ? "untested" : `${pct(p)}, ${BAND_LABEL[b]}`}</span>
    </div>
  );
}
