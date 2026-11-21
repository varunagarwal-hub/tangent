import { connection } from "next/server";
import { getUnderTheHood } from "@/lib/uth";

export async function GET() {
  await connection();
  return Response.json(await getUnderTheHood());
}
