import { connection } from "next/server";
import { z } from "zod";
import { CONCEPTS } from "@/lib/content";
import { createAssignment } from "@/lib/teacher";

const Body = z.object({ conceptId: z.string().max(4) });

export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !CONCEPTS.some((c) => c.id === parsed.data.conceptId)) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await createAssignment(parsed.data.conceptId));
}
