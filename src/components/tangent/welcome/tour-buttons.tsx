"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { openDemoGuide, openTour, setPersona } from "../demo-guide/events";

/** Re-opens the welcome tour (role picker). */
export function TourButton({ className, children = "Take the tour" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openTour} className={cn("inline-flex items-center gap-1.5", className)}>
      <HelpCircle className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

/** Starts the guided demo as Riya and lands on Today. */
export function GuidedDemoButton({ className, children = "Start the guided demo" }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await setPersona("riya");
      openDemoGuide();
      router.push("/today");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} className={cn("inline-flex items-center gap-1.5 disabled:opacity-60", className)}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Compass className="size-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
