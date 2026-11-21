/**
 * Static syllabus content (committed JSON). Safe on server and client.
 */
import conceptsJson from "../../data/concepts.json";
import misconceptionsJson from "../../data/misconceptions.json";

export interface ConceptDef {
  id: string;
  name: string;
  area: string;
  prerequisites: string[];
  target_time_sec: number;
  weight: number;
}

export interface MisconceptionDef {
  id: string;
  concept_id: string;
  name: string;
  description: string;
  wrong_reasoning_example: string;
  telltale_signs: string[];
  contrast_question_idea: string;
}

export const CONCEPTS = conceptsJson as ConceptDef[];
export const MISCONCEPTIONS = misconceptionsJson as MisconceptionDef[];

export const AREAS = ["Arithmetic", "Number System", "Algebra", "Geometry", "Modern Math"] as const;

const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
const mcById = new Map(MISCONCEPTIONS.map((m) => [m.id, m]));

export function getConcept(id: string): ConceptDef {
  const c = conceptById.get(id);
  if (!c) throw new Error(`Unknown concept ${id}`);
  return c;
}

export function getMisconception(id: string | null | undefined): MisconceptionDef | null {
  return id ? (mcById.get(id) ?? null) : null;
}

export function misconceptionsFor(conceptId: string): MisconceptionDef[] {
  return MISCONCEPTIONS.filter((m) => m.concept_id === conceptId);
}

/** Concepts that list `id` as a prerequisite. */
export function dependentsOf(id: string): ConceptDef[] {
  return CONCEPTS.filter((c) => c.prerequisites.includes(id));
}
