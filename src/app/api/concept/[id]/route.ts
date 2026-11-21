import { connection } from "next/server";
import { CONCEPTS } from "@/lib/content";
import { getConceptDetail } from "@/lib/views";
import { getStudentId } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!CONCEPTS.some((c) => c.id === id)) return Response.json({ error: "unknown concept" }, { status: 404 });
  return Response.json(await getConceptDetail(await getStudentId(), id));
}
