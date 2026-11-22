import { connection } from "next/server";
import { z } from "zod";
import { getSession, rateCard } from "@/lib/flashcards";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";

/** Today's flashcard session (due first, then up to 5 new). */
export async function GET() {
  await connection();
  return Response.json(await getSession(await getStudentId()));
}

const Body = z.object({ cardId: z.string().max(20), rating: z.enum(["Again", "Hard", "Good", "Easy"]) });

export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`cards:${studentId}`, 120);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const r = await rateCard(studentId, parsed.data.cardId, parsed.data.rating);
  if (!r) return Response.json({ error: "unknown card" }, { status: 404 });
  return Response.json(r);
}
