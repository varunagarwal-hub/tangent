"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LS, lsSet } from "./events";

/** Confirm → POST /api/demo/reset → refresh. Restores Riya's scripted state and clears teacher corrections. */
export function ResetDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      const r = await fetch("/api/demo/reset", { method: "POST" });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(body.error ?? `Reset failed (${r.status})`);
      lsSet(LS.demoDone, "[]");
      onOpenChange(false);
      toast.success("Demo reset: Riya is back to her scripted state.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reset the demo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="bg-paper p-6 sm:max-w-md">
        <DialogTitle className="font-serif text-2xl font-normal text-ink">Reset the demo?</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-ink-soft">
          This puts Riya back to her scripted state (weak on Percentages and Profit &amp; Loss, one misconception being fixed, 4 reviews due) and clears
          any teacher corrections, so the &ldquo;Detective learned&rdquo; count goes back to 0. Everything else stays as it is.
        </DialogDescription>
        <DialogFooter className="-mx-6 -mb-6 mt-2 gap-2 px-6 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={reset} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            Reset demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
