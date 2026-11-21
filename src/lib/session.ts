import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { MEHTA_ID, PERSONA_COOKIE, RIYA_ID, type PersonaKey } from "@/lib/personas";

export interface Persona {
  key: PersonaKey;
  id: string;
  name: string;
  role: "student" | "teacher";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Current demo persona from the cookie. Defaults to Riya. */
export async function getPersona(): Promise<Persona> {
  const id = (await cookies()).get(PERSONA_COOKIE)?.value;
  if (!id || id === RIYA_ID || !UUID.test(id)) return { key: "riya", id: RIYA_ID, name: "Riya Sharma", role: "student" };
  if (id === MEHTA_ID) return { key: "mehta", id: MEHTA_ID, name: "Prof. Mehta", role: "teacher" };
  const [row] = await db.select({ name: schema.students.name, role: schema.students.role }).from(schema.students).where(eq(schema.students.id, id));
  if (!row) return { key: "riya", id: RIYA_ID, name: "Riya Sharma", role: "student" };
  return { key: "new", id, name: row.name, role: row.role };
}

/** Student id for student-facing routes (teachers fall back to Riya's view). */
export async function getStudentId(): Promise<string> {
  const p = await getPersona();
  return p.role === "student" ? p.id : RIYA_ID;
}
