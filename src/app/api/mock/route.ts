import { connection } from "next/server";
import { z } from "zod";
import { getMockState, saveProgress, startMock, submitMock } from "@/lib/mock";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { getStudentId } from "@/lib/session";

export const maxDuration = 60;

/** The in-progress mock (if any), past scores and the last results. */
export async function GET() {
  await connection();
  return Response.json(await getMockState(await getStudentId()));
}

const Answers = z.record(
  z.string().uuid(),
  z.object({ answer: z.string().max(200).nullable(), marked: z.boolean(), timeSec: z.number().min(0).max(3600) }),
);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("save"), id: z.string().uuid(), answers: Answers }),
  z.object({ action: z.literal("submit"), id: z.string().uuid(), answers: Answers }),
]);

export async function POST(req: Request) {
  await connection();
  const studentId = await getStudentId();
  const rl = rateLimit(`mock:${studentId}`, 60);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  if (b.action === "start") return Response.json(await startMock(studentId));
  if (b.action === "save") return Response.json(await saveProgress(studentId, b.id, b.answers));
  const results = await submitMock(studentId, b.id, b.answers);
  if (!results) return Response.json({ error: "mock not found or already submitted" }, { status: 409 });
  return Response.json({ results });
}
