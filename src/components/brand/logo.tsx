import { cn } from "@/lib/utils";

/**
 * The Tangent mark: a hand-drawn curve, a straight tangent line breaking off it,
 * and a red-pen dot at the touch point.
 */
export function LogoMark({ className, title = "Tangent" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={cn("h-7 w-auto", className)} role="img" aria-label={title}>
      {/* the curve (your reasoning) */}
      <path
        d="M3 27 C 9 26, 13 22, 17 15 S 27 4, 37 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* the tangent breaking off */}
      <path d="M17 15 L 31 25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 0" opacity="0.75" />
      {/* the red-pen touch point */}
      <circle cx="17" cy="15" r="3.2" fill="var(--redpen)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ink", className)}>
      <LogoMark />
      <span className="font-serif text-2xl leading-none tracking-tight">tangent</span>
    </span>
  );
}
