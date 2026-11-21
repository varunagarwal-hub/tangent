"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { ArrowRight, FastForward, Map as MapIcon, RotateCcw } from "lucide-react";
import type { MapData, MapNode, RevealPayload } from "@/lib/api-types";
import { PenLoader } from "@/components/tangent/pen-loader";
import { Button } from "@/components/ui/button";
import { RevealGraph, REVEAL_R, revealGeometry } from "@/components/tangent/map/reveal-graph";
import { pickStartHere, summarize } from "@/components/tangent/map/layout";

gsap.registerPlugin(useGSAP, DrawSVGPlugin, SplitText);
gsap.config({ nullTargetWarn: false });

const REVEAL_KEY = "tangent-reveal";

function readPayload(): RevealPayload | null {
  try {
    const raw = sessionStorage.getItem(REVEAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as RevealPayload;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function fallbackSummary(nodes: MapNode[], start: MapNode | null, payload: RevealPayload | null, now: number): string {
  const c = summarize(nodes, now);
  const parts: string[] = [];
  const results = payload?.results;
  if (results && results.length) {
    parts.push(`You got ${results.filter((r) => r.correct).length} of ${results.length} diagnostic questions right.`);
  }
  parts.push(
    `You're solid on ${c.solid} concept${c.solid === 1 ? "" : "s"}${c.mid ? `, getting there on ${c.mid}` : ""}, and shaky on ${c.shaky}; ${c.untested} ${c.untested === 1 ? "is" : "are"} still untested.`,
  );
  if (start) {
    const dependents = nodes.filter((n) => n.prerequisites.includes(start.conceptId)).map((n) => n.name);
    parts.push(
      `${start.name} (${Math.round((start.p ?? 0) * 100)}%) is the foundation to fix first${dependents.length ? `: ${dependents.slice(0, 2).join(" and ")} build on it` : ""}.`,
    );
  }
  if (c.due) parts.push(`${c.due} concept${c.due === 1 ? " is" : "s are"} already fading and due for a quick review.`);
  return parts.join(" ");
}

type Card = { title: string; sub: string };

export function RevealClient() {
  const [map, setMap] = useState<MapData | null>(null);
  const [payload, setPayload] = useState<RevealPayload | null>(null);
  const [error, setError] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [now, setNow] = useState(0);
  const scope = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  const load = useCallback(() => {
    setError(false);
    fetch("/api/map")
      .then((r) => (r.ok ? (r.json() as Promise<MapData>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setNow(Date.now());
        setMap(d);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    setPayload(readPayload());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    load();
  }, [load]);

  const geo = useMemo(() => (map ? revealGeometry(map) : null), [map]);
  const start = useMemo(() => (map ? pickStartHere(map.nodes) : null), [map]);
  const summary = useMemo(
    () => (payload?.summary?.trim() ? payload.summary.trim() : map ? fallbackSummary(map.nodes, start, payload, now) : ""),
    [payload, map, start, now],
  );
  const cards: Card[] = useMemo(() => {
    const fromPayload = (payload?.misconceptions ?? []).filter(Boolean).slice(0, 3);
    if (fromPayload.length) return fromPayload.map((m) => ({ title: m, sub: "Off on a tangent" }));
    if (!map) return [];
    return map.nodes
      .filter((n) => n.hasActiveMisconception)
      .sort((a, b) => b.weight - a.weight || (a.p ?? 1) - (b.p ?? 1))
      .slice(0, 3)
      .map((n) => ({ title: n.name, sub: `Off on a tangent · ${n.conceptId}, ${n.p == null ? "untested" : `${Math.round(n.p * 100)}%`}` }));
  }, [payload, map]);

  const ready = !!(map && geo);

  useGSAP(
    () => {
      if (!ready || !scope.current) return;
      const q = gsap.utils.selector(scope);
      if (reduced) {
        gsap.from(scope.current, { opacity: 0, duration: 0.5, ease: "none" });
        return;
      }
      const split = SplitText.create(q(".rv-headline"), { type: "words,chars", wordsClass: "rv-word" });
      const t = gsap.timeline({ defaults: { ease: "power3.out" } });
      t.from(split.chars, { yPercent: 110, opacity: 0, rotate: 4, duration: 0.7, stagger: 0.028 })
        .from(q(".rv-sub"), { opacity: 0, y: 10, duration: 0.5 }, "-=0.35")
        .from(q(".rv-area"), { opacity: 0, y: -6, duration: 0.4, stagger: 0.06 }, "-=0.2")
        .fromTo(q(".rv-edge"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.045, ease: "power1.inOut" }, "-=0.1")
        .from(q(".rv-node"), { scale: 0, duration: 0.5, stagger: 0.035, ease: "back.out(2.4)" }, "-=0.6")
        .from(q(".rv-fill"), { scale: 0, duration: 0.6, stagger: 0.03, ease: "power2.out" }, "-=0.25")
        .from(q(".rv-label"), { opacity: 0, y: -4, duration: 0.3, stagger: 0.02 }, "<")
        .fromTo(q(".rv-circle"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.95, ease: "power2.inOut" }, "+=0.25")
        .fromTo(q(".rv-arrow"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power1.out" }, "-=0.1")
        .from(q(".rv-note"), { opacity: 0, x: -12, rotate: -10, duration: 0.5 }, "-=0.25")
        .from(q(".rv-mis"), { x: 48, opacity: 0, duration: 0.6, stagger: 0.16 }, "+=0.2")
        .from(q(".rv-summary"), { y: 18, opacity: 0, duration: 0.6, stagger: 0.12 }, "+=0.05");
      tl.current = t;
      return () => {
        tl.current = null;
      };
    },
    { scope, dependencies: [ready, reduced], revertOnUpdate: true },
  );

  if (error) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
        <PenLoader label="Your map didn't load." className="[&_.tg-squiggle]:animate-none [&_.tg-pen]:animate-none" />
        <Button variant="outline" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!map || !geo) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <PenLoader label="Drawing your map…" />
      </div>
    );
  }

  const sp = start ? geo.pos.get(start.conceptId) : undefined;
  const noteStyle = sp
    ? ({ left: `${Math.max(0, Math.min(70, ((sp.x - REVEAL_R - 6) / geo.width) * 100))}%` } as React.CSSProperties)
    : undefined;

  return (
    <div ref={scope} className="relative flex min-h-[calc(100dvh-8rem)] flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="rv-sub font-mono text-xs tracking-[0.2em] text-ink-soft uppercase">Diagnostic complete · your mastery map</p>
          <h1 className="rv-headline text-5xl leading-[0.95] text-ink sm:text-7xl">
            Here&apos;s how you <span className="text-redpen italic">think.</span>
          </h1>
        </div>
        {!reduced && (
          <div className="flex gap-2 sm:pt-1">
            <Button variant="outline" size="sm" onClick={() => tl.current?.progress(1)} className="bg-card">
              <FastForward aria-hidden="true" /> Skip animation
            </Button>
            <Button variant="ghost" size="sm" onClick={() => tl.current?.restart()}>
              <RotateCcw aria-hidden="true" /> Replay
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="paper-card relative bg-card/60 p-3 sm:p-5">
          <div className="relative">
            <RevealGraph data={map} geo={geo} start={start} />
            {start && (
              <p
                style={noteStyle}
                className="rv-note margin-note pointer-events-none absolute top-0 w-max max-w-[70%] -rotate-2 text-base leading-none sm:text-[1.35rem]"
              >
                Start here: {start.name}, {Math.round((start.p ?? 0) * 100)}%
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {cards.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="rv-mis-h">
              <h2 id="rv-mis-h" className="rv-summary text-2xl text-ink">
                Where your reasoning drifts
              </h2>
              <ol className="flex flex-col gap-3">
                {cards.map((c, i) => (
                  <li key={c.title} className="rv-mis paper-card relative overflow-hidden border-l-4 border-l-redpen py-3 pr-4 pl-4">
                    <span className="font-hand text-lg leading-none text-redpen">{c.sub}</span>
                    <p className="mt-1 font-serif text-xl leading-snug text-ink">
                      <span className="mr-2 font-mono text-sm text-ink-soft">{i + 1}.</span>
                      {c.title}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="rv-summary text-base leading-relaxed text-ink sm:text-lg">{summary}</p>

          <div className="rv-summary flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/today"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 font-serif text-2xl text-paper shadow-[var(--shadow-paper)] transition-colors hover:bg-ink/85"
            >
              Your plan
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
            <Link href="/map" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-ink underline-offset-4 hover:underline">
              <MapIcon className="size-4" aria-hidden="true" /> Open the full map
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
