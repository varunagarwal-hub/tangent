"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HOME = { riya: "/today", mehta: "/teacher", new: "/onboarding" } as const;

/** Sets the demo persona cookie, then navigates to that persona's home. */
export function PersonaButton({
  persona,
  children,
  variant = "primary",
  className,
}: {
  persona: keyof typeof HOME;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "link";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await fetch("/api/persona", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona }) });
      router.push(HOME[persona]);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-left text-base font-medium transition disabled:opacity-60",
        variant === "primary" && "bg-ink text-paper shadow-[var(--shadow-paper)] hover:opacity-90",
        variant === "secondary" && "border-2 border-ink bg-card text-ink hover:bg-accent",
        variant === "link" && "px-0 py-0 text-ink-soft underline underline-offset-4 hover:text-ink",
        className,
      )}
    >
      {children}
      {variant !== "link" && <ArrowRight className="size-4" />}
    </button>
  );
}
