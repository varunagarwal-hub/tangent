import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";

// Phase 0 placeholder: shows the design tokens. Replaced by the landing page in Phase 5.
const swatches = [
  ["Ink", "bg-ink"],
  ["Red pen", "bg-redpen"],
  ["Highlighter", "bg-highlighter"],
  ["< 0.4", "bg-mastery-low"],
  ["0.4–0.7", "bg-mastery-mid"],
  ["> 0.7", "bg-mastery-high"],
  ["Unknown", "bg-mastery-unknown"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="mt-12">
        <h1 className="text-4xl sm:text-6xl leading-[1.05]">
          Your answer was wrong. Let&apos;s find where you went{" "}
          <span className="italic text-redpen">off on a tangent.</span>
        </h1>
        <p className="mt-4 text-ink-soft max-w-xl">
          An adaptive CAT Quant tutor that reads your rough work, finds the exact line where your thinking
          veered off, and rebuilds your prep around it.
        </p>
      </section>

      <section className="paper-card mt-10 p-6">
        <h2 className="text-2xl hand-underline">Design tokens</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(([label, cls]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`h-6 w-6 rounded-full border ${cls}`} aria-hidden />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-sm">mastery 0.62 · elo 1284 · 00:42</p>
        <p className="mt-3">
          <span className="highlight">Key insight:</span> successive changes multiply, they don&apos;t add.
        </p>
        <p className="margin-note mt-3">Off on a tangent here — 20% then −20% isn&apos;t 0%.</p>
      </section>
    </main>
  );
}
