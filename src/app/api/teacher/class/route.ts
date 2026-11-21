import { connection } from "next/server";
import { getClassData } from "@/lib/teacher";

export async function GET() {
  await connection();
  return Response.json(await getClassData());
}
