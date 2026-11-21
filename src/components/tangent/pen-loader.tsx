"use client";

import { cn } from "@/lib/utils";

/** A small pen writing a squiggle, with a handwritten caption. */
export function PenLoader({ label = "Reading your working…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("inline-flex items-center gap-2 text-ink-soft", className)}>
      <svg viewBox="0 0 72 28" className="h-7 w-[72px] shrink-0 overflow-visible" aria-hidden="true">
        <path
          d="M4 18 C 8 10, 12 10, 14 16 S 20 24, 24 16 S 32 8, 36 16 S 44 24, 48 16 S 56 10, 60 16"
          fill="none"
          className="tg-squiggle stroke-redpen"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* the pen: nib at (4,18) at rest */}
        <g className="tg-pen" style={{ transformBox: "view-box" }}>
          <g transform="translate(4 18) rotate(-40)">
            <rect x="1.5" y="-3" width="20" height="6" rx="1.5" className="fill-ink" />
            <rect x="15" y="-3" width="2" height="6" className="fill-paper" opacity="0.6" />
            <path d="M1.5 -3 L -3 0 L 1.5 3 Z" className="fill-ink" />
          </g>
        </g>
      </svg>
      <span className="font-hand text-lg leading-none">{label}</span>
    </div>
  );
}
