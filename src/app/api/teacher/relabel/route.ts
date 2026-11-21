import { connection } from "next/server";
import { z } from "zod";
import { relabelAttempt } from "@/lib/teacher";

const Body = z.object({
  attemptId: z.string().uuid(),
  action: z.enum(["confirm", "relabel"]),
  misconceptionId: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const r = await relabelAttempt(parsed.data);
  return r.ok ? Response.json(r) : Response.json(r, { status: 400 });
}
