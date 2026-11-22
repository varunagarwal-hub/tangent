import { connection } from "next/server";
import { z } from "zod";
import { saveSprintResult, sprintBests } from "@/lib/games";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";
import { GENERATORS } from "@/lib/sprint";

/** Personal bests per category (rounds themselves are generated on the client, seeded). */
export async function GET() {
  await connection();
  return Response.json({ bests: await sprintBests(await getStudentId()) });
}

const kinds = Object.keys(GENERATORS) as [keyof typeof GENERATORS, ...(keyof typeof GENERATORS)[]];
const Body = z.object({
  category: z.enum(["all", "percent", "squares", "fractions"]),
  answers: z.array(z.object({ kind: z.enum(kinds), correct: z.boolean(), ms: z.number().int().min(0).max(60_000) })).max(150),
});

export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`sprint:${studentId}`, 12);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await saveSprintResult(studentId, parsed.data.category, parsed.data.answers));
}
