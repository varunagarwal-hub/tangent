import { connection } from "next/server";
import { z } from "zod";
import { buildSpotGame, saveSpotResult } from "@/lib/games";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";

/** A fresh 10-round game of Spot the Tangent for the current student. */
export async function GET() {
  await connection();
  const studentId = await getStudentId();
  return Response.json(await buildSpotGame(studentId));
}

const Body = z.object({
  results: z
    .array(z.object({ roundId: z.string().max(80), lineTries: z.union([z.literal(0), z.literal(1), z.literal(2)]), named: z.boolean() }))
    .max(10),
});

/** Save a finished game (score recomputed server-side). */
export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`spot:${studentId}`, 12);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await saveSpotResult(studentId, parsed.data.results));
}
