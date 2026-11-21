import { connection } from "next/server";
import { getStudentDrilldown } from "@/lib/teacher";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const d = await getStudentDrilldown(id);
  return d ? Response.json(d) : Response.json({ error: "not found" }, { status: 404 });
}
