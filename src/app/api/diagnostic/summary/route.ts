import { rateLimit, tooMany } from "@/lib/rate-limit";
import { connection } from "next/server";
import { z } from "zod";
import { diagnosticSummary } from "@/lib/agents/diagnostician";
import { activeMisconceptions, masteryMap } from "@/lib/repo";
import { getMisconception } from "@/lib/content";
import { getStudentId } from "@/lib/session";

export const maxDuration = 30;

const Body = z.object({ results: z.array(z.object({ conceptId: z.string(), correct: z.boolean() })).max(20) });

export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const studentId = await getStudentId();
  const rl = rateLimit(`summary:${studentId}`, 10);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const mastery = await masteryMap(studentId);
  const mcs = (await activeMisconceptions(studentId)).map((e) => getMisconception(e.misconceptionId)?.name).filter((x): x is string => !!x);
  const summary = await diagnosticSummary({ studentId, results: parsed.data.results, mastery, misconceptions: mcs.slice(0, 3) });
  return Response.json({ summary, misconceptions: mcs.slice(0, 3) });
}
