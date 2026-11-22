import { connection } from "next/server";
import { z } from "zod";
import { DIAGNOSTIC_LENGTH, nextDiagnosticConcept } from "@/lib/agents/diagnostician";
import { masteryMap, pickQuestion, studentElo, toPublic } from "@/lib/repo";
import { getStudentId } from "@/lib/session";
import type { TraceStep } from "@/lib/api-types";

const Body = z.object({
  asked: z.array(z.object({ conceptId: z.string(), correct: z.boolean(), questionId: z.string().optional() })).max(DIAGNOSTIC_LENGTH),
});

/** Adaptive diagnostic: deterministic choice of the next concept + question. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { asked } = parsed.data;
  if (asked.length >= DIAGNOSTIC_LENGTH) return Response.json({ done: true, total: DIAGNOSTIC_LENGTH });

  const t0 = Date.now();
  const studentId = await getStudentId();
  const mastery = await masteryMap(studentId);
  const next = nextDiagnosticConcept(asked, mastery);
  const exclude = asked.map((a) => a.questionId).filter((x): x is string => !!x);
  const q = await pickQuestion({ conceptId: next.conceptId, studentElo: await studentElo(studentId, next.conceptId), exclude, studentId });
  if (!q) return Response.json({ error: "no question" }, { status: 404 });

  const trace: TraceStep[] = [{ agent: "diagnostician", summary: next.reason, ms: Date.now() - t0, status: "ok" }];
  return Response.json({ done: false, index: asked.length, total: DIAGNOSTIC_LENGTH, question: toPublic(q), trace });
}
