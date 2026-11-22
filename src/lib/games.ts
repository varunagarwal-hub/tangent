import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getConcept, getMisconception, MISCONCEPTIONS } from "@/lib/content";
import { activeMisconceptions, masteryMap, stepLifecycle } from "@/lib/repo";
import roundsData from "../../data/spot-rounds.json";

const s = schema;

export interface SpotRoundData {
  id: string;
  misconceptionId: string;
  conceptId: string;
  question: string;
  lines: { n: number; text: string }[];
  errorLine: number;
  fix: string;
  source: "library" | "seed";
}
const ROUNDS = roundsData as SpotRoundData[];
const ROUND_BY_ID = new Map(ROUNDS.map((r) => [r.id, r]));

export const SPOT_ROUNDS_PER_GAME = 10;
export const SPOT_POINTS = { lineFirstTry: 10, lineSecondTry: 5, named: 10 } as const;

export interface SpotGameRound {
  id: string;
  question: string;
  conceptName: string;
  lines: { n: number; text: string }[];
  errorLine: number;
  misconceptionId: string;
  options: { id: string; name: string }[];
  explanation: { name: string; description: string; fix: string };
  yours: boolean; // the student's own active misconception
}

/** Start of today in India time (the app runs on IST). */
export function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600_000);
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "−": "⁻", "+": "⁺", n: "ⁿ", t: "ᵗ", x: "ˣ" };
/** "x^2" → "x²", "(1.2)^(n)" → "(1.2)ⁿ"; leaves LaTeX ($…$) and anything it can't map untouched. */
export function prettyPowers(text: string) {
  if (text.includes("$")) return text;
  const map = (e: string) => ([...e].every((c) => SUP[c]) ? [...e].map((c) => SUP[c]).join("") : null);
  return text
    .replace(/\^\(([^()]{1,8})\)/g, (m, e: string) => map(e) ?? m)
    .replace(/\^([−-]?[0-9]+|[ntx])(?![0-9]|\.[0-9])/g, (m, e: string) => map(e) ?? m);
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Two plausible wrong names: same concept first, then same area, then anything. */
function distractors(misconceptionId: string, conceptId: string) {
  const area = getConcept(conceptId)?.area;
  const sameConcept = MISCONCEPTIONS.filter((m) => m.concept_id === conceptId && m.id !== misconceptionId);
  const sameArea = MISCONCEPTIONS.filter((m) => m.concept_id !== conceptId && getConcept(m.concept_id)?.area === area);
  const rest = MISCONCEPTIONS.filter((m) => getConcept(m.concept_id)?.area !== area);
  const out: typeof MISCONCEPTIONS = [];
  for (const pool of [shuffle(sameConcept), shuffle(sameArea), shuffle(rest)]) for (const m of pool) if (out.length < 2) out.push(m);
  return out;
}

/**
 * A 10-round game: the student's active misconceptions first (Riya meets her own A1 slip early),
 * then rounds weighted toward weak concepts; never the same misconception twice in one game.
 */
export async function buildSpotGame(studentId: string): Promise<{ rounds: SpotGameRound[]; best: number | null }> {
  const [active, mastery, best] = await Promise.all([activeMisconceptions(studentId), masteryMap(studentId), personalBest(studentId, "spot")]);
  const activeIds = new Set(active.map((a) => a.misconceptionId));
  const used = new Set<string>();
  const picked: SpotRoundData[] = [];

  for (const a of active.slice(0, 2)) {
    const r = shuffle(ROUNDS.filter((x) => x.misconceptionId === a.misconceptionId))[0];
    if (r) { picked.push(r); used.add(r.misconceptionId); }
  }
  // weighted draw by weakness (unknown concepts count as middling)
  const rest = ROUNDS.filter((r) => !used.has(r.misconceptionId));
  const weight = (r: SpotRoundData) => 0.25 + (1 - (mastery[r.conceptId] ?? 0.5));
  const pool = [...rest];
  while (picked.length < SPOT_ROUNDS_PER_GAME && pool.length) {
    const total = pool.reduce((t, r) => t + weight(r), 0);
    let x = Math.random() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { x -= weight(pool[i]); if (x <= 0) break; }
    const r = pool.splice(i, 1)[0];
    if (used.has(r.misconceptionId)) continue;
    used.add(r.misconceptionId);
    picked.push(r);
  }
  // round 1 is a warm-up; the student's own misconceptions come right after it (rounds 2–3)
  const ownCount = picked.filter((r) => activeIds.has(r.misconceptionId)).length;
  const own = picked.slice(0, ownCount);
  const others = picked.slice(ownCount);
  const ordered = others.length ? [others[0], ...own, ...others.slice(1)] : own;

  return {
    best,
    rounds: ordered.map((r) => {
      const m = getMisconception(r.misconceptionId)!;
      return {
        id: r.id,
        question: prettyPowers(r.question),
        conceptName: getConcept(r.conceptId)?.name ?? r.conceptId,
        lines: r.lines.map((l) => ({ n: l.n, text: prettyPowers(l.text) })),
        errorLine: r.errorLine,
        misconceptionId: r.misconceptionId,
        options: shuffle([m, ...distractors(r.misconceptionId, r.conceptId)]).map((x) => ({ id: x.id, name: x.name })),
        explanation: { name: m.name, description: prettyPowers(m.description), fix: prettyPowers(r.fix) },
        yours: activeIds.has(r.misconceptionId),
      };
    }),
  };
}

export async function personalBest(studentId: string, game: "spot" | "sprint") {
  const [row] = await db
    .select({ score: s.gameScores.score })
    .from(s.gameScores)
    .where(and(eq(s.gameScores.studentId, studentId), eq(s.gameScores.game, game)))
    .orderBy(desc(s.gameScores.score))
    .limit(1);
  return row?.score ?? null;
}

export interface SpotRoundResult { roundId: string; lineTries: 0 | 1 | 2; named: boolean }

/**
 * Save a finished game. The score is recomputed here from the per-round results.
 * Spotting AND naming one of the student's own active misconceptions counts as a clean answer
 * in the Mistake Journal, at most once per misconception per IST day.
 */
export async function saveSpotResult(studentId: string, results: SpotRoundResult[]) {
  const valid = results.filter((r) => ROUND_BY_ID.has(r.roundId)).slice(0, SPOT_ROUNDS_PER_GAME);
  const score = valid.reduce(
    (t, r) => t + (r.lineTries === 1 ? SPOT_POINTS.lineFirstTry : r.lineTries === 2 ? SPOT_POINTS.lineSecondTry : 0) + (r.named ? SPOT_POINTS.named : 0),
    0,
  );
  const prevBest = await personalBest(studentId, "spot");

  const active = new Set((await activeMisconceptions(studentId)).map((a) => a.misconceptionId));
  const todays = await db
    .select({ details: s.gameScores.details })
    .from(s.gameScores)
    .where(and(eq(s.gameScores.studentId, studentId), eq(s.gameScores.game, "spot"), gte(s.gameScores.createdAt, istDayStart())));
  const creditedToday = new Set(todays.flatMap((t) => ((t.details as { credited?: string[] } | null)?.credited ?? [])));
  const credited: string[] = [];
  for (const r of valid) {
    const mid = ROUND_BY_ID.get(r.roundId)!.misconceptionId;
    if (r.lineTries > 0 && r.named && active.has(mid) && !creditedToday.has(mid) && !credited.includes(mid)) {
      await stepLifecycle(studentId, mid, { kind: "clean_correct" });
      credited.push(mid);
    }
  }

  await db.insert(s.gameScores).values({
    studentId,
    game: "spot",
    score,
    details: {
      rounds: valid.map((r) => ({ ...r, misconceptionId: ROUND_BY_ID.get(r.roundId)!.misconceptionId })),
      credited,
      max: SPOT_ROUNDS_PER_GAME * (SPOT_POINTS.lineFirstTry + SPOT_POINTS.named),
    },
  });

  return {
    score,
    max: SPOT_ROUNDS_PER_GAME * (SPOT_POINTS.lineFirstTry + SPOT_POINTS.named),
    best: Math.max(score, prevBest ?? 0),
    isBest: prevBest == null || score > prevBest,
    credited: credited.map((id) => getMisconception(id)?.name ?? id),
  };
}
