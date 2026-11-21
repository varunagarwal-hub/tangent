/** Fixed IDs for the demo personas (selected by the `tangent-persona` cookie). */
export const PERSONA_COOKIE = "tangent-persona";

export const RIYA_ID = "00000000-0000-4000-8000-000000000001";
export const MEHTA_ID = "00000000-0000-4000-8000-000000000002";
export const CLASS_ID = "00000000-0000-4000-8000-0000000000c1";

export const PERSONAS = {
  riya: { id: RIYA_ID, name: "Riya Sharma", role: "student" as const, home: "/today" },
  mehta: { id: MEHTA_ID, name: "Prof. Mehta", role: "teacher" as const, home: "/teacher" },
} as const;

export type PersonaKey = keyof typeof PERSONAS | "new";
