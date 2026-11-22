import { CONCEPTS, getMisconception } from "@/lib/content";
import lessonsData from "../../data/lessons.json";

/** One concept card per concept, generated offline by scripts/build-lessons.ts (worked example verified by Pro). */
export interface Lesson {
  conceptId: string;
  keyIdea: string;
  formulas: { label: string; latex: string }[];
  example: { question: string; steps: string[]; answer: string };
  tangents: { misconceptionId: string; fix: string }[];
  shortcuts: { title: string; body: string }[];
  verified: { answer: string; by: "pro" };
}

const LESSONS = lessonsData as Lesson[];
const BY_ID = new Map(LESSONS.map((l) => [l.conceptId, l]));

export function getLesson(conceptId: string) {
  const l = BY_ID.get(conceptId);
  if (!l) return null;
  return {
    ...l,
    tangents: l.tangents.map((t) => {
      const m = getMisconception(t.misconceptionId);
      return { ...t, name: m?.name ?? t.misconceptionId, description: m?.description ?? "" };
    }),
  };
}

/** First sentence of the key idea, for the index. */
export function lessonIndex() {
  return CONCEPTS.filter((c) => BY_ID.has(c.id)).map((c) => ({
    conceptId: c.id,
    name: c.name,
    area: c.area,
    teaser: (BY_ID.get(c.id)!.keyIdea.match(/^[^.!?]+[.!?]/)?.[0] ?? BY_ID.get(c.id)!.keyIdea).trim(),
  }));
}
