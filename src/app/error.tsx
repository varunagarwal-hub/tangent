"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl">Something slipped.</h1>
      <p className="margin-note mt-4">
        Not your reasoning this time, ours. Your answers so far are saved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-ink px-5 py-3 text-paper">
          Try again
        </button>
        <Link href="/today" className="rounded-lg border px-5 py-3 hover:bg-accent">
          Back to today
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-ink-soft">ref {error.digest}</p>}
    </main>
  );
}
