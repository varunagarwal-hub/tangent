import { connection } from "next/server";
import { classQueries } from "@/lib/queries";

/** Teacher inbox of student questions (demo class). */
export async function GET() {
  await connection();
  return Response.json({ queries: await classQueries() });
}
