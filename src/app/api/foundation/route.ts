import { connection } from "next/server";
import { z } from "zod";
import { FOUNDATIONS, buildCheck, buildRepair, getFoundation, saveCheck, saveRepair } from "@/lib/foundation";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";

/** GET → overview; ?set=check → the 12-question check; ?set=repair&skill=F2 → a 5-question repair set. Answer keys never leave the server. */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const set = url.searchParams.get("set");
  if (set === "check") return Response.json({ questions: buildCheck() });
  if (set === "repair") {
    const skill = url.searchParams.get("skill") ?? "";
    if (!FOUNDATIONS.some((f) => f.id === skill)) return Response.json({ error: "unknown skill" }, { status: 400 });
    return Response.json({ questions: buildRepair(skill) });
  }
  return Response.json(await getFoundation(await getStudentId()));
}

const Answers = z.array(z.object({ id: z.string().max(20), choice: z.number().int().min(0).max(3).nullable() })).max(12);
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("check"), answers: Answers }),
  z.object({ kind: z.literal("repair"), skillId: z.string().max(4), answers: Answers }),
]);

export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`foundation:${studentId}`, 20);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  if (b.kind === "check") return Response.json(await saveCheck(studentId, b.answers));
  return Response.json(await saveRepair(studentId, b.skillId, b.answers));
}
