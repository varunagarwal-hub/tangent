import { connection } from "next/server";
import { masteryNodes } from "@/lib/repo";
import { getStudentId } from "@/lib/session";

export async function GET() {
  await connection();
  return Response.json({ nodes: await masteryNodes(await getStudentId()) });
}
