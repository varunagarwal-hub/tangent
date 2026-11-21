"use client";

import { useState, useSyncExternalStore } from "react";
import { Lightbulb, X } from "lucide-react";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function readHidden(key: string) {
  try {
    return localStorage.getItem(key) === "hidden";
  } catch {
    return false; // storage unavailable: show the tip, the safe default
  }
}

/**
 * "How this page works": 2–3 plain steps at the top of a page. Dismissable; remembered per page
 * in localStorage when it's available.
 */
export function PageIntro({ id, title = "How this page works", steps }: { id: string; title?: string; steps: string[] }) {
  const key = `tangent:intro:${id}`;
  const stored = useSyncExternalStore(subscribe, () => readHidden(key), () => false);
  const [dismissed, setDismissed] = useState(false);

  if (stored || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(key, "hidden");
    } catch {
      /* fine: hidden for this visit */
    }
  };

  return (
    <aside
      aria-label={title}
      className="relative mb-6 rounded-xl border border-dashed border-ink/25 bg-highlighter/25 px-4 py-3 pr-10 text-ink dark:bg-highlighter/10"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-redpen" aria-hidden="true" />
        {title}
      </p>
      <ol className="mt-1.5 grid gap-x-6 gap-y-1 text-sm leading-relaxed text-ink sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-redpen">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this tip"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-ink-soft hover:bg-ink/5 hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
