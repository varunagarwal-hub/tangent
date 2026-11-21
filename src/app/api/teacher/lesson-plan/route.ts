import { connection } from "next/server";
import { buildLessonPlan } from "@/lib/agents/teacher-analyst";

export const maxDuration = 60;

export async function POST() {
  await connection();
  try {
    return Response.json(await buildLessonPlan());
  } catch (e) {
    console.error("[lesson-plan]", e);
    return Response.json({ error: "Couldn't build the lesson plan. Please try again." }, { status: 500 });
  }
}
