import { connection } from "next/server";
import { getMapData } from "@/lib/views";
import { getStudentId } from "@/lib/session";

export async function GET() {
  await connection();
  return Response.json(await getMapData(await getStudentId()));
}
