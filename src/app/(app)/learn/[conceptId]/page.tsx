import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Lightbulb, Zap } from "lucide-react";
import { CONCEPTS, getConcept } from "@/lib/content";
import { getLesson } from "@/lib/lessons";
import { MathText } from "@/components/tangent/math-text";
import { WorkedExample } from "./worked-example";
import { ConceptStatus } from "./concept-status";

export function generateStaticParams() {
  return CONCEPTS.map((c) => ({ conceptId: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ conceptId: string }> }): Promise<Metadata> {
  const { conceptId } = await params;
  const c = CONCEPTS.find((x) => x.id === conceptId);
  return { title: c ? `${c.name} · Concept card · Tangent` : "Concept card · Tangent" };
}

export default function ConceptCardPage({ params }: { params: Promise<{ conceptId: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl border border-dashed border-border" aria-hidden="true" />}>
      <ConceptCard params={params} />
    </Suspense>
  );
}

async function ConceptCard({ params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  if (!CONCEPTS.some((c) => c.id === conceptId)) notFound();
  const lesson = getLesson(conceptId);
  if (!lesson) notFound();
  const concept = getConcept(conceptId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All concept cards
      </Link>

      <header>
        <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">{concept.area} · concept card</p>
        <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">{concept.name}</h1>
      </header>

      <ConceptStatus conceptId={conceptId} />

      <section className="paper-card p-5" aria-labelledby="key-idea">
        <h2 id="key-idea" className="flex items-center gap-2 text-2xl">
          <Lightbulb className="size-5 text-redpen" aria-hidden="true" /> The key idea
        </h2>
        <MathText text={lesson.keyIdea} className="mt-2 block text-lg leading-relaxed text-ink" />
      </section>

      <section aria-labelledby="formulas">
        <h2 id="formulas" className="mb-3 text-2xl">Formulas to know</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {lesson.formulas.map((f) => (
            <li key={f.label} className="paper-card p-4">
              <p className="text-sm font-semibold text-ink-soft">{f.label}</p>
              <div className="mt-1 overflow-x-auto text-ink">
                <MathText text={`$$${f.latex}$$`} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <WorkedExample example={lesson.example} />

      <section aria-labelledby="tangents">
        <h2 id="tangents" className="mb-1 text-2xl">Common tangents</h2>
        <p className="mb-3 text-ink-soft">Where students usually go off course on {concept.name.toLowerCase()}, and how to stay on it.</p>
        <ul className="space-y-3">
          {lesson.tangents.map((t) => (
            <li key={t.misconceptionId} className="paper-card p-4">
              <p className="font-semibold text-ink">{t.name}</p>
              <MathText text={t.description} className="mt-1 block text-sm leading-relaxed text-ink-soft" />
              <p className="margin-note mt-2">
                <b className="font-semibold">Instead:</b> <MathText text={t.fix} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="shortcuts">
        <h2 id="shortcuts" className="mb-3 text-2xl">CAT shortcuts</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {lesson.shortcuts.map((s) => (
            <li key={s.title} className="paper-card p-4">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Zap className="size-4 shrink-0 text-redpen" aria-hidden="true" /> {s.title}
              </p>
              <MathText text={s.body} className="mt-1 block text-sm leading-relaxed text-ink-soft" />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-dashed border-border pt-5">
        <Link
          href={`/practice?concept=${conceptId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
        >
          Practise {concept.name} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link href="/map" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          See it on your map
        </Link>
      </div>
    </div>
  );
}
