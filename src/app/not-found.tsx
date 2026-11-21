import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-10 font-mono text-sm text-ink-soft">404</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">
        This page went <span className="italic text-redpen">off on a tangent.</span>
      </h1>
      <p className="margin-note mt-4">Let&apos;s get you back on the curve.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-lg bg-ink px-5 py-3 text-paper">
          Home
        </Link>
        <Link href="/today" className="rounded-lg border px-5 py-3 hover:bg-accent">
          Today&apos;s plan
        </Link>
      </div>
    </main>
  );
}
