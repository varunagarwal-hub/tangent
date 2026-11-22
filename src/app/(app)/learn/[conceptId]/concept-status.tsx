"use client";

import { useEffect, useState } from "react";
import type { ConceptDetail } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { masteryTone } from "../learn-index";

/** The student's own standing on this concept: mastery and any open tangents. */
export function ConceptStatus({ conceptId }: { conceptId: string }) {
  const [d, setD] = useState<ConceptDetail | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/concept/${encodeURIComponent(conceptId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => x && setD(x))
      .catch(() => {});
    return () => ctrl.abort();
  }, [conceptId]);

  if (!d) return <div className="h-[74px] animate-pulse rounded-xl border border-dashed border-border" aria-hidden="true" />;

  const tone = masteryTone(d.p);
  const open = d.misconceptions.filter((m) => m.status !== "resolved");
  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-dashed border-border px-4 py-3" aria-label="Your status">
      <div className="min-w-40">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Your mastery</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-border">
            <div className={cn("h-full", tone.bar)} style={{ width: `${Math.round((d.p ?? 0) * 100)}%` }} />
          </div>
          <span className="font-mono text-sm text-ink">{tone.label}</span>
          {d.attempts > 0 && <span className="text-xs text-ink-soft">· {d.attempts} attempts</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Your open tangents</p>
        {open.length ? (
          <p className="mt-1 text-sm text-redpen">{open.map((m) => m.name).join(" · ")}</p>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">None right now.</p>
        )}
      </div>
    </section>
  );
}
