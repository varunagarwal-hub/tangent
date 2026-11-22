"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Skill { id: string; name: string; state: "solid" | "shaky" | "repaired" | "unchecked" }

/** Foundation skills (F1–F8) as a small row under the Mastery Map. */
export function FoundationRow() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    fetch("/api/foundation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSkills(d.skills);
        setChecked(d.checked);
      })
      .catch(() => {});
  }, []);
  if (!skills) return null;
  return (
    <section aria-labelledby="foundations-h" className="paper-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="foundations-h" className="text-xl">Foundations underneath</h2>
        <Link href="/foundation" className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
          {checked ? "Open foundations" : "Take the 10-minute check"} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {skills.map((s) => (
          <li
            key={s.id}
            className={cn(
              "rounded-full border px-3 py-1",
              s.state === "shaky" && "border-redpen/50 bg-redpen/8 text-redpen",
              (s.state === "solid" || s.state === "repaired") && "border-mastery-high/50 bg-mastery-high/10 text-mastery-high",
              s.state === "unchecked" && "border-dashed text-ink-soft",
            )}
            title={s.state === "unchecked" ? "Not checked yet" : s.state}
          >
            {s.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
