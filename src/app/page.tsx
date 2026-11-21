import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { PersonaButton } from "@/components/brand/persona-button";
import { Hero } from "@/components/landing/hero";
import { RedPenDemo } from "@/components/landing/red-pen-demo";
import { Features } from "@/components/landing/features";
import { ConceptGraph } from "@/components/landing/concept-graph";
import { SmoothScroll } from "@/components/landing/smooth-scroll";

const STEPS = [
  {
    n: "1",
    title: "Take a 12-question diagnostic",
    body: "Adaptive: it starts at the high-weight roots and steps down to prerequisites when you miss. Your Mastery Map fills in as you go.",
  },
  {
    n: "2",
    title: "Practise with your rough work",
    body: "Type, draw or photograph your working. The Detective circles the exact line where you went off on a tangent and names the misconception.",
  },
  {
    n: "3",
    title: "Follow the plan it rebuilds",
    body: "Contrast questions for live misconceptions, prerequisite drills, spaced reviews before you forget. Every answer updates the plan.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-x-clip px-4 py-6 sm:py-8">
      <SmoothScroll />
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href="/under-the-hood" className="hidden text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:inline">
            Under the hood
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <Hero />
      <RedPenDemo />
      <Features />
      <ConceptGraph />

      <section className="mt-28 sm:mt-36" aria-labelledby="how-title">
        <p className="font-hand text-2xl text-redpen">how it works</p>
        <h2 id="how-title" className="mt-1 text-4xl text-ink sm:text-5xl">
          Three steps <span className="hand-underline">back onto the curve</span>
        </h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="paper-card p-6">
              <span className="font-mono text-3xl text-redpen">{s.n}</span>
              <h3 className="mt-2 text-2xl leading-tight text-ink">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="paper-card graph-paper mt-28 flex flex-col items-start gap-6 p-8 sm:mt-36 sm:p-12" aria-labelledby="cta-title">
        <h2 id="cta-title" className="max-w-2xl text-4xl text-ink sm:text-5xl">
          See it catch a tangent in under a minute.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PersonaButton persona="riya" className="py-4 text-lg">
            Try as Riya (student)
          </PersonaButton>
          <PersonaButton persona="mehta" variant="secondary" className="py-4 text-lg">
            Try as Prof. Mehta (teacher)
          </PersonaButton>
        </div>
      </section>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-6 text-sm text-ink-soft">
        <span>Built for the Product Space Agentic AI Hackathon</span>
        <Link href="/under-the-hood" className="underline underline-offset-4 hover:text-ink">
          Under the hood: 7 agents, BKT, Elo, FSRS
        </Link>
      </footer>
    </main>
  );
}
