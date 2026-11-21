"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * A small ⓘ that explains one piece of jargon in plain words.
 * Opens on hover (desktop), tap (phone) and Enter/Space (keyboard).
 */
export function InfoTip({ term, className }: { term: GlossaryTerm; className?: string }) {
  const g = GLOSSARY[term];
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={`What does "${g.title}" mean?`}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-ink-soft transition-colors hover:text-redpen focus-visible:text-redpen focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-redpen",
          className,
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-[18rem] rounded-xl border border-ink/30 bg-popover p-3 text-left shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] normal-case tracking-normal outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity">
            <Popover.Title className="text-sm font-semibold text-ink">{g.title}</Popover.Title>
            <Popover.Description className="mt-1 text-sm leading-relaxed font-normal text-ink-soft">{g.body}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
