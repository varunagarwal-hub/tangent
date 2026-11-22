import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/gemini";
import { CONCEPTS, dependentsOf, getConcept, getMisconception } from "@/lib/content";
import * as L from "@/lib/learner";
import {
  activeMisconceptions,
  dueCards,
  getMasteryRows,
  pickQuestion,
  recentQuestionIds,
  stepLifecycle,
  studentElo,
  toPublic,
} from "@/lib/repo";
import type { NextAction, NextActionKind } from "@/lib/api-types";
import type { TraceStep } from "./trace";

interface Candidate {
  kind: Exclude<NextActionKind, "diagnostic">;
  conceptId: string;
  misconceptionId?: string;
  score: number;
  reason: string; // deterministic reason (also the fallback "why")
}

/** Deterministic scorer over candidate next moves. */
export async function scoreCandidates(studentId: string, lastConceptId?: string | null): Promise<Candidate[]> {
  const rows = await getMasteryRows(studentId);
  const p = Object.fromEntries(rows.map((r) => [r.conceptId, r.pMastery]));
  const seen = new Set(rows.map((r) => r.conceptId));
  const prior = (id: string) => p[id] ?? L.priorFromPrereqs(getConcept(id).prerequisites.map((x) => p[x]).filter((v): v is number => v != null));
  const cands: Candidate[] = [];

  // 1) contrast question for the strongest active misconception
  const active = await activeMisconceptions(studentId);
  for (const e of active.slice(0, 2)) {
    const m = getMisconception(e.misconceptionId);
    if (!m) continue;
    cands.push({
      kind: "contrast_question",
      conceptId: m.concept_id,
      misconceptionId: m.id,
      score: 100 + Math.min(20, e.evidenceCount * 5) - (e.status === "fixing" ? 5 : 0),
      reason: `This question is built so that "${m.name.toLowerCase()}" leads to a tempting wrong option. Let's see if the fix has stuck.`,
    });
  }

  // 2) prerequisite drill: weak prerequisite blocking a dependent concept
  for (const c of CONCEPTS) {
    const pc = p[c.id];
    if (pc == null || pc >= L.PREREQ_READY_THRESHOLD) continue;
    const deps = dependentsOf(c.id);
    if (!deps.length) continue;
    cands.push({
      kind: "prerequisite_drill",
      conceptId: c.id,
      score: 70 + 20 * c.weight * ((L.PREREQ_READY_THRESHOLD - pc) / L.PREREQ_READY_THRESHOLD),
      reason: `${c.name} is at ${Math.round(pc * 100)}%, and ${deps.map((d) => d.name).join(", ")} build${deps.length === 1 ? "s" : ""} on it. Fixing the foundation first.`,
    });
  }

  // 3) review: FSRS-due concepts
  const due = (await dueCards(studentId)).filter((c) => c.itemType === "concept");
  for (const d of due.slice(0, 3)) {
    const days = (Date.now() - new Date(d.dueAt).getTime()) / 86_400_000;
    const c = getConcept(d.itemId);
    cands.push({
      kind: "review",
      conceptId: c.id,
      score: 55 + Math.min(20, days * 2),
      reason: `${c.name} is due for review: your memory of it is starting to fade, and a quick recall now makes it stick longer.`,
    });
  }

  // 4) practice: biggest weight × (1 − mastery) gap among ready concepts
  // 5) stretch: strong concepts get a harder question
  for (const c of CONCEPTS) {
    const pc = prior(c.id);
    if (!L.isReady(c.prerequisites, p)) continue;
    const gap = c.weight * (1 - pc);
    cands.push({
      kind: "practice",
      conceptId: c.id,
      score: 25 + 12 * gap * (seen.has(c.id) ? 1 : 0.6),
      reason: `${c.name} carries ${c.weight === 3 ? "high" : c.weight === 2 ? "solid" : "some"} weight in recent CAT papers and you're at ${Math.round(pc * 100)}%. That's the biggest gain per minute right now.`,
    });
    if (pc > 0.8) {
      cands.push({
        kind: "stretch",
        conceptId: c.id,
        score: 18 + 5 * c.weight,
        reason: `You're strong on ${c.name} (${Math.round(pc * 100)}%), so here's a harder one to keep it sharp at CAT speed.`,
      });
    }
  }

  // variety: don't hammer the same concept twice in a row (except a contrast question)
  for (const c of cands) if (c.conceptId === lastConceptId && c.kind !== "contrast_question") c.score -= 25;
  return cands.sort((a, b) => b.score - a.score);
}

const WhyOutput = z.object({ why: z.string() });

async function writeWhy(c: Candidate, studentId: string): Promise<{ why: string; step: TraceStep }> {
  const t0 = Date.now();
  try {
    const concept = getConcept(c.conceptId);
    const m = getMisconception(c.misconceptionId);
    const { data } = await generateStructured({
      agent: "planner",
      tier: "fast",
      system:
        "You are a warm, concise CAT Quant mentor (Indian English). In ONE sentence (max 28 words), tell the student why this next question is the right one for them. Use 'you'. No greetings, no emojis, no percentile predictions.",
      prompt: `Move: ${c.kind.replace("_", " ")}\nConcept: ${concept.name}\n${m ? `Misconception being fixed: ${m.name}\n` : ""}Planner's reason: ${c.reason}`,
      schema: WhyOutput,
      studentId,
      inputSummary: `why ${c.kind} ${c.conceptId}`,
      thinking: "LOW",
      timeoutMs: 8_000,
      temperature: 0.6,
    });
    return { why: data.why.trim(), step: { agent: "planner", summary: "Wrote the \"Why this question?\" note", ms: Date.now() - t0, status: "ok" } };
  } catch {
    return { why: c.reason, step: { agent: "planner", summary: "Used the planner's own reason (AI was slow)", ms: Date.now() - t0, status: "fallback" } };
  }
}

/** Picks the next best action for a student and a question for it. */
export async function planNext(
  studentId: string,
  opts: { lastConceptId?: string | null; exclude?: string[]; mode?: "review" } = {},
): Promise<NextAction | null> {
  const t0 = Date.now();
  let cands = await scoreCandidates(studentId, opts.lastConceptId);
  if (opts.mode === "review") {
    // review queue: due concepts first, then active misconceptions (their cards are due by design)
    const reviewOnly = cands.filter((c) => c.kind === "review" || c.kind === "contrast_question");
    if (reviewOnly.length) cands = reviewOnly;
  }
  const exclude = [...(opts.exclude ?? []), ...(await recentQuestionIds(studentId, 20))];

  for (const c of cands.slice(0, 8)) {
    const elo = await studentElo(studentId, c.conceptId);
    const target = c.kind === "stretch" ? elo + 150 : elo;
    const q = await pickQuestion({ conceptId: c.conceptId, studentElo: target, exclude, targetMisconceptionId: c.misconceptionId ?? null, studentId });
    if (!q) continue;

    const top = cands.slice(0, 3).map((x) => `${x.kind.replace("_", " ")} ${x.conceptId} (${Math.round(x.score)})`).join(", ");
    const planStep: TraceStep = {
      agent: "planner",
      summary: `Scored ${cands.length} moves → ${c.kind.replace("_", " ")} on ${getConcept(c.conceptId).name}. Top: ${top}`,
      ms: Date.now() - t0,
      status: "ok",
    };
    const pickStep: TraceStep = {
      agent: "learner_model",
      summary: `Picked a ${q.source} question at Elo ${Math.round(q.difficultyElo)}: predicted P(correct) ${Math.round(L.expectedCorrect(target, q.difficultyElo) * 100)}%`,
      ms: 0,
      status: "ok",
    };
    if (c.kind === "contrast_question" && c.misconceptionId) await stepLifecycle(studentId, c.misconceptionId, { kind: "contrast_served" });
    const { why, step } = await writeWhy(c, studentId);
    return {
      kind: c.kind,
      conceptId: c.conceptId,
      conceptName: getConcept(c.conceptId).name,
      misconceptionId: c.misconceptionId ?? null,
      why,
      question: toPublic(q),
      trace: [planStep, pickStep, step],
    };
  }
  return null;
}
