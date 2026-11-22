"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PERCENTILES = [85, 90, 95, 97, 99];
const MINUTES = [30, 45, 60, 90, 120];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(95);
  const [examDate, setExamDate] = useState("2027-11-28");
  const [minutes, setMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  async function finish(next: "/diagnostic" | "/foundation" = "/diagnostic") {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, targetPercentile: target, examDate, dailyMinutes: minutes }),
      });
    } finally {
      router.push(next);
    }
  }

  const steps = [
    {
      title: "What's your target?",
      body: (
        <>
          <label className="block text-sm text-ink-soft" htmlFor="name">
            Your first name (optional)
          </label>
          <input
            id="name"
            className="mt-1 w-full rounded-lg border bg-card px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aarav"
          />
          <p className="mt-5 text-sm text-ink-soft">Target CAT percentile</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Target percentile">
            {PERCENTILES.map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={target === p}
                onClick={() => setTarget(p)}
                className={`rounded-lg border px-4 py-2 font-mono ${target === p ? "border-ink bg-ink text-paper" : "hover:bg-accent"}`}
              >
                {p}+
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      title: "When is your CAT?",
      body: (
        <>
          <label className="block text-sm text-ink-soft" htmlFor="exam">
            Exam date
          </label>
          <input
            id="exam"
            type="date"
            className="mt-1 rounded-lg border bg-card px-3 py-2 font-mono"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <p className="margin-note mt-4">Your plan and review spacing adapt to the days left.</p>
        </>
      ),
    },
    {
      title: "How much time a day?",
      body: (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Minutes per day">
          {MINUTES.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={`rounded-lg border px-4 py-2 font-mono ${minutes === m ? "border-ink bg-ink text-paper" : "hover:bg-accent"}`}
            >
              {m} min
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-wider text-redpen">
        Step {step + 1} of {steps.length}
      </p>
      <div className="paper-card mt-3 p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl">{steps[step].title}</h1>
        <div className="mt-6">{steps[step].body}</div>
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="size-4" />
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <Button onClick={() => finish()} disabled={saving}>
                Start the diagnostic <ArrowRight className="size-4" />
              </Button>
              <button type="button" onClick={() => finish("/foundation")} disabled={saving} className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                Rusty on school maths? Do a 10-minute foundation check first
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
