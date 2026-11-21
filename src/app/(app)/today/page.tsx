import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CalendarClock, Flame, NotebookPen, RotateCcw, Timer } from "lucide-react";
import { getStudentId } from "@/lib/session";
import { getTodayData } from "@/lib/views";
import { scoreCandidates } from "@/lib/agents/planner";
import { getConcept, getMisconception } from "@/lib/content";
import { PenLoader } from "@/components/tangent/pen-loader";
import { StatusChip } from "@/components/tangent/status-chip";
import { PageIntro } from "@/components/tangent/page-intro";
import { MyQuestions } from "@/components/tangent/my-questions";
import { InfoTip } from "@/components/tangent/info-tip";

export const metadata: Metadata = { title: "Today · Tangent" };

const KIND_LABEL: Record<string, string> = {
  contrast_question: "Fix a misconception",
  prerequisite_drill: "Fix the foundation",
  review: "Review before you forget",
  practice: "Biggest gain per minute",
  stretch: "Stretch",
};

function band(p: number | null) {
  if (p == null) return { cls: "bg-mastery-unknown", label: "untested" };
  if (p < 0.4) return { cls: "bg-mastery-low", label: "shaky" };
  if (p <= 0.7) return { cls: "bg-mastery-mid", label: "getting there" };
  return { cls: "bg-mastery-high", label: "solid" };
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

async function TodayContent() {
  await connection(); // per-request: reads the clock and the persona cookie
  const studentId = await getStudentId();
  const [t, cands] = await Promise.all([getTodayData(studentId), scoreCandidates(studentId)]);
  const top = cands[0];
  const firstName = t.name.split(" ")[0];

  if (t.isNew) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-4xl">Welcome, {firstName}.</h1>
        <p className="mt-3 text-ink-soft">
          Twelve adaptive questions. Show your rough work and Tangent will map how you think, not just what you got right.
        </p>
        <Link href="/diagnostic" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-paper">
          Start the diagnostic <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const topMc = getMisconception(top?.misconceptionId);
  const reviews = t.dueConcepts.length + t.dueMisconceptions;

  return (
    <div className="space-y-6">
      <PageIntro
        id="today"
        steps={[
          "Start with the next best move: the planner picked it for you, and \"Why this?\" says why.",
          "Clear your due reviews: quick recall questions on concepts you're about to forget.",
          "Check mastery by area and your Mistake Journal to see what's improving.",
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-2xl text-redpen">{greeting()},</p>
          <h1 className="text-4xl sm:text-5xl">{firstName}&apos;s plan for today</h1>
        </div>
        <dl className="flex flex-wrap gap-3">
          <Stat icon={<Flame className="size-4 text-redpen" />} label="day streak" value={t.streak} />
          {t.daysToCat != null && <Stat icon={<CalendarClock className="size-4" />} label="days to CAT" value={t.daysToCat} />}
          <Stat icon={<Timer className="size-4" />} label="min today" value={t.dailyMinutes} />
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* next best action */}
        {top && (
          <section className="paper-card relative overflow-hidden border-l-4 border-l-redpen p-6">
            <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-redpen">Next best move · {KIND_LABEL[top.kind]} <InfoTip term="nextMove" className="-my-1" /></p>
            <h2 className="mt-2 text-3xl">
              {topMc ? topMc.name : getConcept(top.conceptId).name}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {getConcept(top.conceptId).name} · {getConcept(top.conceptId).area}
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink">
              <span className="sr-only">Why this? </span>
              {top.reason}
            </p>
            <Link
              href="/practice"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 font-medium text-paper transition hover:opacity-90"
            >
              Start <ArrowRight className="size-4" />
            </Link>
          </section>
        )}

        {/* reviews */}
        <section className="paper-card p-6">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-5" />
            <h2 className="flex items-center gap-1.5 text-2xl">Due for review <InfoTip term="review" /></h2>
          </div>
          <p className="mt-2 font-mono text-5xl">
            <span className={reviews ? "highlight" : ""}>{reviews}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {reviews
              ? "Your memory of these is fading. A quick recall now makes them stick for longer."
              : "Nothing due. Your memory is fresh."}
          </p>
          {t.dueConcepts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {t.dueConcepts.slice(0, 5).map((c) => (
                <li key={c.id} className="rounded-full border px-3 py-1">
                  {c.name}
                </li>
              ))}
              {t.dueMisconceptions > 0 && (
                <li className="rounded-full border border-redpen/40 px-3 py-1 text-redpen">
                  {t.dueMisconceptions} misconception check{t.dueMisconceptions > 1 ? "s" : ""}
                </li>
              )}
            </ul>
          )}
          {reviews > 0 && (
            <Link href="/practice?mode=review" className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-accent">
              Start reviews <ArrowRight className="size-4" />
            </Link>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* mastery by area */}
        <section className="paper-card p-6">
          <h2 className="flex items-center gap-1.5 text-2xl"><span className="hand-underline">Mastery by area</span> <InfoTip term="mastery" /></h2>
          <ul className="mt-6 space-y-4">
            {t.areas.map((a) => {
              const b = band(a.mastery);
              const pct = a.mastery == null ? 0 : Math.round(a.mastery * 100);
              return (
                <li key={a.area}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{a.area}</span>
                    <span className="font-mono text-ink-soft">
                      {a.mastery == null ? "untested" : `${pct}% · ${b.label}`} · {a.tested}/{a.total} tested
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${a.area}: ${a.mastery == null ? "untested" : `${pct}% mastery, ${b.label}`}`}>
                    <div className={`h-full rounded-full ${b.cls}`} style={{ width: `${Math.max(a.mastery == null ? 0 : 4, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/map" className="mt-5 inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:underline">
            Open the Mastery Map <ArrowRight className="size-3.5" />
          </Link>
        </section>

        {/* mistake journal preview */}
        <section className="paper-card p-6">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-5 text-redpen" />
            <h2 className="text-2xl">Mistake Journal</h2>
          </div>
          {t.journal.length ? (
            <ul className="mt-4 divide-y">
              {t.journal.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{j.name}</p>
                    <p className="text-sm text-ink-soft">
                      {j.concept} · seen {j.evidenceCount}×
                    </p>
                  </div>
                  <StatusChip status={j.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="margin-note mt-4">No tangents yet. Show your working and I&apos;ll start a journal.</p>
          )}
          <Link href="/mistakes" className="mt-4 inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:underline">
            Open the journal <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>
      <MyQuestions />
      <p className="text-center text-xs text-ink-soft">
        {t.attemptsTotal} questions answered so far. Tangent never predicts a percentile; it shows readiness by area.
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="paper-card flex items-center gap-2 px-4 py-2">
      {icon}
      <dd className="font-mono text-2xl">{value}</dd>
      <dt className="text-xs text-ink-soft">{label}</dt>
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<PenLoader label="Writing today's plan…" className="mx-auto mt-16" />}>
      <TodayContent />
    </Suspense>
  );
}
