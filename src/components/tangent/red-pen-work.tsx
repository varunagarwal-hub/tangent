"use client";

import { useEffect, useRef, useState } from "react";
import { annotate } from "rough-notation";
import type { RoughAnnotation } from "rough-notation/lib/model";
import { motion, useReducedMotion } from "motion/react";
import type { WorkLine } from "@/lib/api-types";
import { MathText } from "./math-text";
import { cn } from "@/lib/utils";

const CIRCLE_DURATION = 800;
const LONG_LINE_PX = 340;

/** Hand-drawn arrow from the note back toward the circled line. Points left (wide) or up (narrow). */
function Connector({ direction, animate }: { direction: "left" | "up"; animate: boolean }) {
  const d = direction === "left" ? "M40 6 C 30 4, 18 8, 6 18" : "M10 30 C 8 22, 12 12, 20 4";
  const head = direction === "left" ? "M6 18 L 9 9 M6 18 L 15 17" : "M20 4 L 11 7 M20 4 L 21 13";
  return (
    <svg
      viewBox={direction === "left" ? "0 0 44 24" : "0 0 30 34"}
      className={cn("shrink-0 overflow-visible", direction === "left" ? "h-6 w-11" : "h-8 w-7")}
      aria-hidden="true"
    >
      <motion.path
        d={d}
        fill="none"
        className="stroke-redpen"
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: animate ? 0.15 : 0 }}
      />
      <motion.path
        d={head}
        fill="none"
        className="stroke-redpen"
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, delay: animate ? 0.45 : 0 }}
      />
    </svg>
  );
}

function RedTick({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12 shrink-0 overflow-visible" role="img" aria-label="Tick: reasoning is sound">
      <motion.path
        d="M5 22 C 9 25, 13 29, 17 34 C 24 22, 32 12, 44 4"
        fill="none"
        className="stroke-redpen"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}

function MarginNote({
  heading,
  note,
  sound,
  animate,
}: {
  heading: string;
  note: string;
  sound?: boolean;
  animate: boolean;
}) {
  return (
    <>
      {/* wide: note in the right margin, arrow pointing left at the circled line */}
      <motion.div
        className="hidden items-start gap-1 sm:flex"
        initial={animate ? { opacity: 0, x: 18, rotate: 1.5 } : { opacity: 0 }}
        animate={{ opacity: 1, x: 0, rotate: -1 }}
        transition={animate ? { type: "spring", stiffness: 260, damping: 22 } : { duration: 0.2 }}
      >
        {sound ? <RedTick animate={animate} /> : <Connector direction="left" animate={animate} />}
        <NoteBody heading={heading} note={note} />
      </motion.div>
      {/* narrow: note under the line, arrow pointing up */}
      <motion.div
        className="flex items-start gap-1 pl-1 sm:hidden"
        initial={animate ? { opacity: 0, y: -8 } : { opacity: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={animate ? { type: "spring", stiffness: 260, damping: 24 } : { duration: 0.2 }}
      >
        {sound ? <RedTick animate={animate} /> : <Connector direction="up" animate={animate} />}
        <NoteBody heading={heading} note={note} />
      </motion.div>
    </>
  );
}

function NoteBody({ heading, note }: { heading: string; note: string }) {
  return (
    <div className="min-w-0 pt-0.5">
      <p className="mb-0.5 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-redpen">{heading}</p>
      <p className="margin-note">
        <MathText text={note} />
      </p>
    </div>
  );
}

/**
 * The hero moment: the student's rough work on ruled paper, with the red pen circling the exact line
 * where the reasoning went off on a tangent, and a margin note explaining why.
 */
export function RedPenWork({
  lines,
  errorLine,
  note,
  verdict = "unknown",
  label,
  animate = true,
  className,
}: {
  lines: WorkLine[];
  errorLine: number | null;
  note?: string | null;
  verdict?: "sound" | "flawed" | "unknown";
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;
  const rootRef = useRef<HTMLElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const [noteShown, setNoteShown] = useState(false);

  const target = errorLine != null ? lines.find((l) => l.n === errorLine) : undefined;
  const targetKey = target ? `${target.n}:${target.text}` : null;
  const sound = verdict === "sound" && !target;
  const lastLine = lines[lines.length - 1]?.n;

  // Draw the red-pen circle, then let the note slide in. Re-draw (without animation) on resize.
  useEffect(() => {
    const el = targetRef.current;
    const root = rootRef.current;
    if (!targetKey || !el || !root) {
      setNoteShown(sound);
      return;
    }
    setNoteShown(false);
    let annotation: RoughAnnotation | null = null;
    let cancelled = false;
    let timer: number | undefined;
    let raf = 0;
    let lastWidth = root.clientWidth;
    let lastHeight = root.clientHeight;

    const draw = (withAnimation: boolean) => {
      annotation?.remove();
      const long = el.getBoundingClientRect().width > Math.min(LONG_LINE_PX, root.clientWidth * 0.62);
      annotation = annotate(el, {
        type: long ? "box" : "circle",
        color: getComputedStyle(root).getPropertyValue("--redpen").trim() || "#d93a2b",
        strokeWidth: 2,
        iterations: 2,
        padding: long ? [4, 8] : [6, 14],
        animate: withAnimation,
        animationDuration: CIRCLE_DURATION,
      });
      annotation.show();
    };

    const start = async () => {
      try {
        await document.fonts?.ready; // Caveat changes the line width; measure after it loads
      } catch {}
      if (cancelled) return;
      draw(shouldAnimate);
      timer = window.setTimeout(() => !cancelled && setNoteShown(true), shouldAnimate ? CIRCLE_DURATION * 0.85 : 0);
    };
    start();

    // Redraw when the card changes size in EITHER direction: the margin note sliding in makes the
    // row taller, which re-centres the circled line, so the circle must follow it.
    const ro = new ResizeObserver(() => {
      if (root.clientWidth === lastWidth && root.clientHeight === lastHeight) return;
      lastWidth = root.clientWidth;
      lastHeight = root.clientHeight;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => !cancelled && draw(false));
    });
    ro.observe(root);
    // chalkboard ↔ paper: the red changes, so redraw in the new colour
    const mo = new MutationObserver(() => !cancelled && annotation && draw(false));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      annotation?.remove();
    };
  }, [targetKey, sound, shouldAnimate]);

  const heading = sound ? "Back on the curve" : `${label ?? "Off on a tangent"} · line ${errorLine}`;
  const noteText = sound ? (note ?? "Back on the curve: reasoning checks out") : (note ?? "This is where the reasoning went off.");
  const noteLine = sound ? lastLine : target?.n;

  return (
    <figure
      ref={rootRef}
      className={cn("paper-card relative overflow-hidden py-3 pr-3 pl-0 sm:pr-4", className)}
      aria-label="Your rough work, marked up"
    >
      {/* red margin rule */}
      <span aria-hidden="true" className="absolute inset-y-0 left-11 w-px bg-redpen/45 sm:left-12" />
      <span aria-hidden="true" className="absolute inset-y-0 left-12 w-px bg-redpen/20 sm:left-[3.2rem]" />

      <ol className="relative">
        {lines.map((line) => {
          const isError = line.n === target?.n;
          const hasNote = noteShown && line.n === noteLine;
          return (
            <li
              key={line.n}
              className="ruled-row grid min-h-12 grid-cols-[2.75rem_minmax(0,1fr)] items-center sm:min-h-14 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(11rem,17rem)] sm:gap-x-3"
              aria-current={isError ? "step" : undefined}
            >
              <span
                className={cn(
                  "pr-2 text-right font-mono text-xs tabular-nums",
                  isError ? "font-bold text-redpen" : "text-ink-soft",
                )}
              >
                {line.n}
                {isError && <span className="sr-only"> (the line where the reasoning went off)</span>}
              </span>
              <span className="min-w-0 py-1.5 pl-4 font-hand text-[1.6rem] leading-tight text-ink sm:text-[1.75rem]">
                <span ref={isError ? targetRef : undefined} className="relative inline-block max-w-full">
                  <MathText text={line.text} />
                </span>
              </span>
              <div className="col-span-2 pb-2 pl-[3.25rem] sm:col-span-1 sm:pb-0 sm:pl-0">
                {hasNote && <MarginNote heading={heading} note={noteText} sound={sound} animate={shouldAnimate} />}
              </div>
            </li>
          );
        })}
      </ol>

      {/* screen readers get the verdict in one sentence */}
      <figcaption className="sr-only" aria-live="polite">
        {target
          ? `Line ${target.n} is where the reasoning went off on a tangent. ${note ?? ""}`
          : sound
            ? "Back on the curve: your reasoning checks out."
            : "No specific line was flagged."}
      </figcaption>
    </figure>
  );
}
