import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { PersonaButton } from "@/components/brand/persona-button";

// Interim landing (Phase 3). Phase 5 adds the GSAP hero, bento features and the looping red-pen demo.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="mt-16 grid items-center gap-10 sm:mt-24 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="font-hand text-2xl text-redpen">For CAT Quant aspirants</p>
          <h1 className="mt-2 text-5xl leading-[1.02] sm:text-7xl">
            Your answer was wrong. Let&apos;s find where you went <span className="italic text-redpen">off on a tangent.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Tangent reads your rough work (typed, drawn or photographed), finds the exact line where your reasoning veered off, and
            rebuilds your prep around it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PersonaButton persona="riya">Try as Riya (student)</PersonaButton>
            <PersonaButton persona="mehta" variant="secondary">
              Try as Prof. Mehta (teacher)
            </PersonaButton>
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Or{" "}
            <PersonaButton persona="new" variant="link">
              start fresh as a new student
            </PersonaButton>{" "}
            and take the 12-question diagnostic.
          </p>
        </div>

        <figure className="paper-card relative p-5" aria-label="Example: rough work marked up by Tangent">
          <ol className="space-y-3 font-hand text-2xl">
            <li>1. MP = ₹2000</li>
            <li className="relative w-fit">
              2. Total discount = 20% + 10% = 30%
              <svg
                className="pointer-events-none absolute -left-3 -top-2"
                style={{ width: "calc(100% + 1.5rem)", height: "calc(100% + 1rem)" }}
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M6 22 C 4 6, 92 2, 96 18 C 99 34, 10 40, 4 24" fill="none" stroke="var(--redpen)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              </svg>
            </li>
            <li>3. SP = 2000 × 0.7 = ₹1400</li>
          </ol>
          <figcaption className="margin-note mt-4">
            Off on a tangent at line 2: successive discounts multiply. 0.8 × 0.9 = 0.72, so it&apos;s 28%, not 30%.
          </figcaption>
        </figure>
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-16 text-sm text-ink-soft">
        <span>Built for the Product Space Agentic AI Hackathon</span>
        <Link href="/under-the-hood" className="underline underline-offset-4 hover:text-ink">
          Under the hood: 7 agents, BKT, Elo, FSRS
        </Link>
      </footer>
    </main>
  );
}
