import { CircleDot, Check, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/** Misconception lifecycle chip: text + icon + color (never color alone). */
export function StatusChip({ status, className }: { status: "detected" | "fixing" | "resolved"; className?: string }) {
  const cfg = {
    detected: { label: "Off on a tangent", icon: CircleDot, cls: "border-redpen/50 bg-redpen/10 text-redpen" },
    fixing: { label: "Fixing", icon: Wrench, cls: "border-mastery-mid/60 bg-mastery-mid/15 text-ink" },
    resolved: { label: "Back on the curve", icon: Check, cls: "border-mastery-high/50 bg-mastery-high/10 text-mastery-high" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.cls, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
