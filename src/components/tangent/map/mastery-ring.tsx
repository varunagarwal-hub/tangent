import { band, BAND_COLOR } from "./layout";

/** Circular mastery ring: an SVG arc coloured by band; untested = pencil-gray dashed. */
export function MasteryRing({ p, size = 44, stroke = 4 }: { p: number | null; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const b = band(p);
  const pct = p == null ? null : Math.round(p * 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      {pct == null ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BAND_COLOR.unknown} strokeWidth={stroke - 1.5} strokeDasharray="4 3" />
      ) : (
        <>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink)" strokeOpacity={0.1} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BAND_COLOR[b]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.02, pct / 100) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </>
      )}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="font-mono"
        fontSize={pct == null ? size * 0.3 : size * 0.26}
        fill={pct == null ? "var(--ink-soft)" : "var(--ink)"}
        fontWeight={600}
      >
        {pct == null ? "?" : `${pct}%`}
      </text>
    </svg>
  );
}
