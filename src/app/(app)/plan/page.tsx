import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CalendarDays, Flag } from "lucide-react";
import { getStudentId } from "@/lib/session";
import { getRoad, type Road } from "@/lib/road";
import { PenLoader } from "@/components/tangent/pen-loader";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Road to CAT · Tangent" };

const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "Asia/Kolkata" }).format(new Date(`${d}T12:00:00+05:30`));

async function RoadContent() {
  await connection(); // per request: reads the clock and the persona cookie
  const r = await getRoad(await getStudentId());
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-2xl text-redpen">from today to the exam hall</p>
          <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Road to CAT</h1>
          <p className="mt-4 max-w-2xl text-ink-soft">
            Built from your mastery today and redrawn every time it changes. {r.dailyMinutes} minutes a day,{" "}
            {r.examSet ? "CAT on" : "assuming CAT on"} {fmtDate(r.examDate, { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
        <dl className="flex flex-wrap gap-3">
          <Stat label="days to CAT" value={r.daysLeft} />
          <Stat label={`of ${r.coverage.total} concepts solid`} value={r.coverage.solid} />
          <Stat label="weak concepts" value={r.weak.length} />
        </dl>
      </header>

      <Phases phases={r.phases} />
      <Week week={r.week} />
      <Heatmap r={r} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="paper-card flex items-center gap-2 px-4 py-2">
      <dd className="font-mono text-2xl">{value}</dd>
      <dt className="text-xs text-ink-soft">{label}</dt>
    </div>
  );
}

function Phases({ phases }: { phases: Road["phases"] }) {
  return (
    <section aria-labelledby="phases-h">
      <h2 id="phases-h" className="mb-3 flex items-center gap-2 text-2xl">
        <Flag className="size-5 text-redpen" aria-hidden="true" /> The plan
      </h2>
      <ol className="relative space-y-3 border-l-2 border-dashed border-ink/20 pl-5">
        {phases.map((p, k) => (
          <li key={p.key} className={cn("paper-card relative p-4", p.current && "border-l-4 border-l-redpen")}>
            <span
              className={cn("absolute -left-[1.95rem] top-5 grid size-5 place-items-center rounded-full border-2 bg-background font-mono text-[0.65rem]", p.current ? "border-redpen text-redpen" : "border-ink/30 text-ink-soft")}
              aria-hidden="true"
            >
              {k + 1}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-sans text-[1.05rem] font-semibold text-ink">
                {p.title} {p.current && <span className="ml-1 rounded-full border border-redpen/40 px-2 py-0.5 text-xs font-medium text-redpen">you are here</span>}
              </h3>
              <p className="font-mono text-xs text-ink-soft">
                {fmtDate(p.start)} – {fmtDate(p.end)} · ~{p.weeks} wk
              </p>
            </div>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-soft marker:text-redpen/60">
              {p.focus.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Week({ week }: { week: Road["week"] }) {
  return (
    <section aria-labelledby="week-h">
      <h2 id="week-h" className="mb-3 flex items-center gap-2 text-2xl">
        <CalendarDays className="size-5" aria-hidden="true" /> This week
      </h2>
      <ul className="paper-card divide-y divide-dashed divide-border">
        {week.map((d) => (
          <li key={d.date} className={cn("grid gap-2 px-4 py-3 sm:grid-cols-[6rem_1fr_auto] sm:items-center", d.today && "bg-highlighter/15")}>
            <p className={cn("font-mono text-sm", d.today ? "font-semibold text-redpen" : "text-ink-soft")}>
              {d.label}
              {d.today && " · today"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {d.items.map((it) => (
                <li key={it.text}>
                  <Link href={it.href} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-accent", d.past && "opacity-60")}>
                    {it.text} <span className="font-mono text-xs text-ink-soft">{it.minutes}m</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-soft sm:text-right">{d.past || d.today ? (d.activity ? `${d.activity} done` : d.past ? "rest day" : "") : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heatmap({ r }: { r: Road }) {
  const { cells, weeks, max } = r.heatmap;
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shade = ["bg-ink/[0.06]", "bg-mastery-high/30", "bg-mastery-high/55", "bg-mastery-high/80", "bg-mastery-high"];
  // month labels at the first week that starts in a new month
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const m = cells[w * 7].date.slice(0, 7);
    const isNew = w === 0 || m !== cells[(w - 1) * 7].date.slice(0, 7);
    if (isNew && (!months.length || w - months[months.length - 1].col >= 3)) months.push({ col: w, label: fmtDate(cells[w * 7].date, { month: "short" }) });
  }
  return (
    <section aria-labelledby="heat-h">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="heat-h" className="text-2xl">Your last six months</h2>
        <Link href="/practice" className="inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:underline">
          Add to today <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="paper-card p-4">
        <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><dt className="inline text-ink-soft">Questions solved </dt><dd className="inline font-mono font-semibold">{r.totals.questions}</dd></div>
          <div><dt className="inline text-ink-soft">Active days </dt><dd className="inline font-mono font-semibold">{r.totals.activeDays}</dd></div>
          <div><dt className="inline text-ink-soft">Current streak </dt><dd className="inline font-mono font-semibold">{r.totals.streak}</dd></div>
          <div><dt className="inline text-ink-soft">Longest streak </dt><dd className="inline font-mono font-semibold">{r.totals.longest}</dd></div>
        </dl>
        <div className="overflow-x-auto pb-1">
          <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `1.6rem repeat(${weeks}, 0.8rem)` }} role="img" aria-label={`Activity heatmap: ${r.totals.activeDays} active days, ${r.totals.questions} questions in total`}>
            <span />
            {Array.from({ length: weeks }, (_, w) => {
              const m = months.find((x) => x.col === w);
              return <span key={w} className="h-4 overflow-visible whitespace-nowrap text-[0.65rem] text-ink-soft">{m?.label ?? ""}</span>;
            })}
            {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((dname, row) => (
              <div key={row} className="contents">
                <span className="text-[0.65rem] leading-[0.8rem] text-ink-soft">{dname}</span>
                {Array.from({ length: weeks }, (_, w) => {
                  const c = cells[w * 7 + row];
                  return (
                    <span
                      key={c.date}
                      title={c.future ? undefined : `${fmtDate(c.date)}: ${c.n} done`}
                      className={cn("size-[0.8rem] rounded-[3px]", c.future ? "bg-transparent" : shade[level(c.n)])}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
          Less {shade.map((sh) => <span key={sh} className={cn("size-3 rounded-[3px]", sh)} />)} More · questions and games per day
        </p>
      </div>
    </section>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<PenLoader label="Drawing your road…" className="mx-auto mt-16" />}>
      <RoadContent />
    </Suspense>
  );
}
