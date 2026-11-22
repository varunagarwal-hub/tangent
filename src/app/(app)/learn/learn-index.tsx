"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { MapData } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface Item { conceptId: string; name: string; area: string; teaser: string }
type Sort = "area" | "weakest";

export function masteryTone(p: number | null) {
  if (p == null) return { label: "Not started", cls: "border-border text-ink-soft", bar: "bg-mastery-unknown" };
  if (p >= 0.7) return { label: `${Math.round(p * 100)}%`, cls: "border-mastery-high/50 text-mastery-high", bar: "bg-mastery-high" };
  if (p >= 0.4) return { label: `${Math.round(p * 100)}%`, cls: "border-mastery-mid/60 text-amber-ink", bar: "bg-mastery-mid" };
  return { label: `${Math.round(p * 100)}%`, cls: "border-mastery-low/60 text-redpen", bar: "bg-mastery-low" };
}

export function LearnIndex({ lessons }: { lessons: Item[] }) {
  const [map, setMap] = useState<MapData | null>(null);
  const [sort, setSort] = useState<Sort>("area");

  useEffect(() => {
    fetch("/api/map")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMap(d))
      .catch(() => {});
  }, []);

  const byId = useMemo(() => new Map((map?.nodes ?? []).map((n) => [n.conceptId, n])), [map]);

  const groups = useMemo(() => {
    if (sort === "weakest") {
      const list = [...lessons].sort((a, b) => (byId.get(a.conceptId)?.p ?? 0.5) - (byId.get(b.conceptId)?.p ?? 0.5));
      return [{ area: "Weakest first", items: list }];
    }
    const areas: { area: string; items: Item[] }[] = [];
    for (const l of lessons) {
      const g = areas.find((a) => a.area === l.area);
      if (g) g.items.push(l);
      else areas.push({ area: l.area, items: [l] });
    }
    return areas;
  }, [lessons, sort, byId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="font-hand text-2xl text-redpen">one card per idea</p>
        <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Concept cards</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          The key idea, the formulas, a worked example you reveal one step at a time, the tangents students usually go off on, and two CAT shortcuts.
          Every worked example was re-solved by a second model before it went in.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Sort concept cards" className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["area", "weakest"] as Sort[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              onClick={() => setSort(s)}
              className={cn("rounded-md px-3 py-1.5", sort === s ? "bg-ink text-paper" : "text-ink-soft hover:text-ink")}
            >
              {s === "area" ? "By area" : "Weakest first"}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.area} aria-labelledby={`area-${g.area}`}>
          <h2 id={`area-${g.area}`} className="mb-3 text-2xl">{g.area}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.items.map((l) => {
              const n = byId.get(l.conceptId);
              const tone = masteryTone(n?.p ?? null);
              return (
                <li key={l.conceptId}>
                  <Link href={`/learn/${l.conceptId}`} className="paper-card group flex h-full flex-col gap-2 p-4 transition-colors hover:border-ink/40">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-sans text-[1.05rem] font-semibold text-ink">{l.name}</h3>
                      {map && (
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs", tone.cls)}>
                          {tone.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">{l.teaser}</p>
                    <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                      {n?.hasActiveMisconception ? <span className="text-redpen">You have an open tangent here</span> : <span />}
                      <ArrowRight className="size-4 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
