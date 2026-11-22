import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Timer } from "lucide-react";

export const metadata: Metadata = { title: "Play · Tangent" };

const GAMES = [
  {
    href: "/play/spot",
    title: "Spot the Tangent",
    blurb: "Someone else's rough work, one wrong line. Find it, name the mistake. 10 rounds, 200 points.",
    Icon: Search,
  },
  {
    href: "/play/sprint",
    title: "CAT speed sprint",
    blurb: "60 seconds of mental maths: fractions as %, squares and cubes, successive % changes, quick multiplication.",
    Icon: Timer,
  },
];

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-hand text-2xl text-redpen">five minutes, no pressure</p>
        <h1 className="hand-underline mt-1 text-4xl sm:text-5xl">Play</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">Short games that train the same habits as practice: catching slips and working fast.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {GAMES.map(({ href, title, blurb, Icon }) => (
          <li key={href}>
            <Link href={href} className="paper-card group flex h-full flex-col gap-3 p-5 transition-colors hover:border-ink/40">
              <Icon className="size-6 text-redpen" aria-hidden="true" />
              <h2 className="text-2xl">{title}</h2>
              <p className="text-ink-soft">{blurb}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-ink">
                Play <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
