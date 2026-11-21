import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { db, schema } from "@/lib/db";
import { CONCEPTS, MISCONCEPTIONS } from "@/lib/content";
import type { UnderTheHoodData } from "@/lib/api-types";

const s = schema;

function readJson<T>(rel: string): T | null {
  const p = path.join(process.cwd(), rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Short reason class for the verifier's rejection list. */
function reasonClass(r: string) {
  if (r.startsWith("answer mismatch")) return "Answer key didn't match an independent solve";
  if (r.startsWith("ambiguous")) return "Ambiguous or impossible numbers (e.g. non-integer people, no correct option)";
  if (r.includes("generator error") || r.includes("unavailable")) return "Timed out (retried or replaced)";
  if (r.includes("option")) return "Malformed options";
  return "Other";
}

export async function getUnderTheHood(): Promise<UnderTheHoodData> {
  const [feedRows, perAgentRows, counts, generated, verifierRuns] = await Promise.all([
    db.select().from(s.agentRuns).orderBy(desc(s.agentRuns.createdAt)).limit(40),
    db
      .select({
        agent: s.agentRuns.agent,
        runs: sql<number>`count(*)::int`,
        avgMs: sql<number>`avg(${s.agentRuns.latencyMs})::float`,
        errors: sql<number>`count(*) filter (where ${s.agentRuns.status} <> 'ok')::int`,
      })
      .from(s.agentRuns)
      .groupBy(s.agentRuns.agent),
    db.execute(sql`select
      (select count(*) from questions where status = 'active')::int as questions,
      (select count(*) from students where role = 'student')::int as students,
      (select count(*) from attempts)::int as attempts,
      (select count(*) from fewshot_examples where source = 'teacher')::int as teacher_corrections`),
    db.select({ n: sql<number>`count(*)::int` }).from(s.questions).where(eq(s.questions.source, "generated")),
    db
      .select({ ok: sql<number>`count(*) filter (where ${s.agentRuns.status} = 'ok')::int` })
      .from(s.agentRuns)
      .where(eq(s.agentRuns.agent, "verifier")),
  ]);

  const evalJson = readJson<{
    cases: number;
    misconception_accuracy: number;
    error_line_accuracy: number;
    both_accuracy: number;
    avg_ms: number;
    ran_at: string;
    model?: string;
  }>("data/evals/results.json");

  const bank = readJson<unknown[]>("data/questions.json") ?? [];
  const rej = readJson<{ reason: string }[]>("data/questions-rejections.json") ?? [];
  const realRejections = rej.filter((r) => !r.reason.includes("generator error"));
  const accepted = bank.length + (generated[0]?.n ?? 0);
  const byReason = new Map<string, number>();
  for (const r of realRejections) byReason.set(reasonClass(r.reason), (byReason.get(reasonClass(r.reason)) ?? 0) + 1);

  const c = counts.rows[0] as { questions: number; students: number; attempts: number; teacher_corrections: number };
  return {
    feed: feedRows.map((r) => ({
      id: r.id,
      agent: r.agent,
      summary: r.inputSummary ?? "",
      latencyMs: r.latencyMs,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    perAgent: perAgentRows
      .map((r) => ({ agent: r.agent, runs: r.runs, avgMs: r.avgMs != null ? Math.round(r.avgMs) : null, errorRate: r.runs ? r.errors / r.runs : 0 }))
      .sort((a, b) => b.runs - a.runs),
    eval: evalJson
      ? {
          cases: evalJson.cases,
          misconceptionAccuracy: evalJson.misconception_accuracy,
          errorLineAccuracy: evalJson.error_line_accuracy,
          bothAccuracy: evalJson.both_accuracy,
          avgMs: evalJson.avg_ms,
          ranAt: evalJson.ran_at,
          model: evalJson.model ?? null,
        }
      : null,
    verifier: {
      accepted,
      rejected: realRejections.length,
      rejectionRate: realRejections.length / Math.max(1, accepted + realRejections.length),
      topReasons: [...byReason].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
      generatedLive: generated[0]?.n ?? 0,
    },
    counts: {
      concepts: CONCEPTS.length,
      misconceptions: MISCONCEPTIONS.length,
      questions: c.questions,
      students: c.students,
      attempts: c.attempts,
      teacherCorrections: c.teacher_corrections,
    },
  };
}
