import { connection } from "next/server";
import { getStrategyData } from "@/lib/strategy";
import { getStudentId } from "@/lib/session";

export const maxDuration = 30;

export async function GET() {
  await connection();
  return Response.json(await getStrategyData(await getStudentId()));
}
