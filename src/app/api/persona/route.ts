import { cookies } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { CLASS_ID, MEHTA_ID, PERSONA_COOKIE, RIYA_ID } from "@/lib/personas";

const Body = z.object({ persona: z.enum(["riya", "mehta", "new"]), name: z.string().max(60).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { persona, name } = parsed.data;

  let id = persona === "mehta" ? MEHTA_ID : RIYA_ID;
  if (persona === "new") {
    const [row] = await db
      .insert(schema.students)
      .values({ name: name?.trim() || "New student", role: "student", classId: CLASS_ID, examDate: "2027-11-28", dailyMinutes: 60, targetPercentile: 95 })
      .returning({ id: schema.students.id });
    id = row.id;
  }
  (await cookies()).set(PERSONA_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true, id });
}
