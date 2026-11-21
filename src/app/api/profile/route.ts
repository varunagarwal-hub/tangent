import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getPersona } from "@/lib/session";

const Body = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  targetPercentile: z.number().int().min(50).max(100),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyMinutes: z.number().int().min(10).max(600),
});

/** Onboarding: saves goals for the current (new) student. Demo personas are read-only. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const p = await getPersona();
  if (p.key !== "new") return Response.json({ ok: true, skipped: true });
  await db
    .update(schema.students)
    .set({ ...parsed.data, ...(parsed.data.name ? { name: parsed.data.name } : {}) })
    .where(eq(schema.students.id, p.id));
  return Response.json({ ok: true });
}
