import { after, connection } from "next/server";
import { planNext } from "@/lib/agents/planner";
import { ensurePool } from "@/lib/pool";
import { getStudentId } from "@/lib/session";
import { studentElo } from "@/lib/repo";

export const maxDuration = 60;

/** Next best action + question. Pool refill (generator + verifier) runs after the response. */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const lastConceptId = url.searchParams.get("last");
  const exclude = url.searchParams.getAll("exclude").slice(0, 20);
  const studentId = await getStudentId();

  const mode = url.searchParams.get("mode") === "review" ? ("review" as const) : undefined;
  const action = await planNext(studentId, { lastConceptId, exclude, mode });
  if (!action) return Response.json({ error: "no question available" }, { status: 404 });

  after(async () => {
    const elo = await studentElo(studentId, action.conceptId);
    await ensurePool(action.conceptId, elo, action.misconceptionId);
  });
  return Response.json(action);
}
