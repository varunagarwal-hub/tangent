import { connection } from "next/server";
import { z } from "zod";
import { cancelDoubtClass, scheduleDoubtClass, upcomingForClass } from "@/lib/doubt-classes";
import { rateLimit, tooMany } from "@/lib/rate-limit";

/** Upcoming doubt classes for the (demo) class. */
export async function GET() {
  await connection();
  return Response.json({ classes: await upcomingForClass() });
}

const Body = z
  .object({
    misconceptionId: z.string().max(60).nullish(),
    studentNames: z.array(z.string().max(80)).max(40).optional(),
    title: z.string().max(120).optional(),
    startsAt: z.string().datetime({ offset: true }),
    link: z.string().url().max(300).nullish().or(z.literal("")),
  })
  .refine((b) => b.misconceptionId || b.studentNames?.length, { message: "pick a misconception or a group" });

export async function POST(req: Request) {
  await connection();
  const rl = rateLimit("doubt-classes", 30);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const b = parsed.data;
  const startsAt = new Date(b.startsAt);
  if (startsAt.getTime() < Date.now() - 5 * 60_000) return Response.json({ error: "That time has already passed." }, { status: 400 });
  const r = await scheduleDoubtClass({ ...b, link: b.link || null, startsAt });
  if ("error" in r) return Response.json(r, { status: 422 });
  return Response.json(r);
}

export async function DELETE(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "bad id" }, { status: 400 });
  await cancelDoubtClass(id);
  return Response.json({ ok: true });
}
