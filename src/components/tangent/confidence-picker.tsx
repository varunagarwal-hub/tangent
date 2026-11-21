"use client";

import { CircleCheckBig, CircleDot, CircleHelp } from "lucide-react";
import type { Confidence } from "@/lib/api-types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/tangent/info-tip";

const OPTIONS: { value: Confidence; label: string; Icon: typeof CircleHelp }[] = [
  { value: 1, label: "Guessing", Icon: CircleHelp },
  { value: 2, label: "Fairly sure", Icon: CircleDot },
  { value: 3, label: "Certain", Icon: CircleCheckBig },
];

/** How sure are you? Guessing / Fairly sure / Certain. */
export function ConfidencePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Confidence | null;
  onChange: (c: Confidence) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1">
        <span id="tg-confidence-label" className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-soft">
          How sure are you?
        </span>
        <InfoTip term="confidence" />
      </span>
      <ToggleGroup
        aria-labelledby="tg-confidence-label"
        value={value ? [String(value)] : []}
        onValueChange={(v) => {
          const next = Number(v[0]);
          if (next === 1 || next === 2 || next === 3) onChange(next);
        }}
        disabled={disabled}
        variant="outline"
        spacing={1}
        className="grid w-full grid-cols-3 sm:w-fit"
      >
        {OPTIONS.map(({ value: v, label, Icon }) => (
          <ToggleGroupItem
            key={v}
            value={String(v)}
            aria-label={label}
            className="h-10 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper hover:aria-pressed:bg-ink/90 hover:aria-pressed:text-paper"
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
