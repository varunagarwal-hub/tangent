import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { getPersona, getStudentId } from "@/lib/session";
import { FingerprintCard, type FingerprintData } from "@/components/tangent/fingerprint-card";
import { getMistakeJournal, type JournalEntry } from "@/lib/views";
import { CLEAN_TO_RESOLVE } from "@/lib/learner";
import { PenLoader } from "@/components/tangent/pen-loader";
import { StatusChip } from "@/components/tangent/status-chip";
import { MathText } from "@/components/tangent/math-text";

export const metadata: Metadata = { title: "Mistake Journal · Tangent" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

function RedPenTick() {
  return (
    <svg viewBox="0 0 48 40" className="tick-draw h-9 w-11 shrink-0" aria-hidden="true">
      <path d="M5 22 C 10 26, 14 31, 18 35 C 24 24, 33 13, 44 4" fill="none" stroke="var(--redpen)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function Entry({ e }: { e: JournalEntry }) {
  const resolved = e.status === "resolved";
  return (
    <li className={`paper-card relative p-5 ${resolved ? "opacity-90" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            {e.conceptName} · first seen {fmt(e.firstSeen)}
          </p>
          <h3 className="mt-1 text-2xl">{e.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {resolved && <RedPenTick />}
          <StatusChip status={e.status} />
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{e.description}</p>

      {e.lastErrorLine && (
        <div className="mt-4 rounded-lg border border-dashed border-redpen/40 bg-redpen/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-redpen">Tangent point, last time</p>
          <p className="mt-1 font-hand text-2xl decoration-redpen decoration-wavy underline-offset-4 [text-decoration-line:underline]">
            {e.lastErrorLine}
          </p>
          {e.lastExplanation && <MathText text={e.lastExplanation} className="margin-note mt-2 block text-lg" />}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          Seen <span className="font-mono">{e.evidenceCount}×</span>
        </span>
        {!resolved && (
          <span className="flex items-center gap-2">
            Clean answers since:
            <span className="flex gap-1" aria-label={`${e.cleanCount} of ${CLEAN_TO_RESOLVE} clean answers`}>
              {Array.from({ length: CLEAN_TO_RESOLVE }, (_, i) => (
                <span key={i} className={`size-3 rounded-full border ${i < e.cleanCount ? "border-mastery-high bg-mastery-high" : "border-ink/30"}`} />
              ))}
            </span>
            <span className="text-ink-soft">({CLEAN_TO_RESOLVE} clean answers with sound reasoning resolve it)</span>
          </span>
        )}
        {resolved && <span className="text-mastery-high">Resolved {fmt(e.updatedAt)}. It reopens if it comes back.</span>}
      </div>

      {e.example && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-soft">What this mistake looks like</summary>
          <pre className="mt-2 whitespace-pre-wrap font-hand text-xl leading-snug text-ink">{e.example}</pre>
        </details>
      )}
      {!resolved && (
        <Link href="/practice" className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
          Practise the fix <ArrowRight className="size-3.5" />
        </Link>
      )}
    </li>
  );
}

async function Journal() {
  await connection();
  const [persona, studentId] = await Promise.all([getPersona(), getStudentId()]);
  const entries = await getMistakeJournal(studentId);
  const active = entries.filter((e) => e.status !== "resolved");
  const resolved = entries.filter((e) => e.status === "resolved");
  const byWeight = (a: JournalEntry, b: JournalEntry) => b.evidenceCount - a.evidenceCount;
  const fingerprint: FingerprintData = {
    studentName: persona.role === "student" ? persona.name : "Riya Sharma",
    items: [...active.sort(byWeight), ...resolved.sort(byWeight)].slice(0, 4).map((e) => ({
      name: e.name,
      conceptName: e.conceptName,
      status: e.status,
      evidenceCount: e.evidenceCount,
      cleanCount: e.cleanCount,
    })),
    active: active.length,
    resolved: resolved.length,
    caught: entries.reduce((n, e) => n + e.evidenceCount, 0),
    cleanToResolve: CLEAN_TO_RESOLVE,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="hand-underline text-4xl sm:text-5xl">Mistake Journal</h1>
        <p className="mt-4 max-w-2xl text-ink-soft">
          Every place your reasoning went off on a tangent, and how far you are from fixing it. Each one moves from
          <span className="mx-1 font-medium text-redpen">Off on a tangent</span>→<span className="mx-1 font-medium">Fixing</span>→
          <span className="mx-1 font-medium text-mastery-high">Back on the curve</span>.
        </p>
        <p className="mt-3 font-mono text-sm">
          {active.length} active · {resolved.length} resolved
        </p>
      </header>

      {entries.length === 0 && (
        <div className="paper-card p-8 text-center">
          <p className="margin-note">No tangents yet. Show your rough work while practising and I&apos;ll start a journal.</p>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl">Active</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {active.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl">Back on the curve</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {resolved.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}

      {entries.length > 0 && (
        <section aria-labelledby="fp-title">
          <p className="font-hand text-xl text-redpen">share it</p>
          <h2 id="fp-title" className="mb-4 text-2xl">
            Mistake Fingerprint
          </h2>
          <FingerprintCard data={fingerprint} />
        </section>
      )}
    </div>
  );
}

export default function MistakesPage() {
  return (
    <Suspense fallback={<PenLoader label="Opening your journal…" className="mx-auto mt-16" />}>
      <Journal />
    </Suspense>
  );
}
