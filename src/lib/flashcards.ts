import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getConcept } from "@/lib/content";
import * as L from "@/lib/learner";
import { masteryMap } from "@/lib/repo";
import { istDayStart } from "@/lib/games";
import cardsData from "../../data/flashcards.json";

const s = schema;

export interface Flashcard { id: string; conceptId: string; kind: "formula" | "shortcut"; front: string; back: string }
const CARDS = cardsData as Flashcard[];
const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export const NEW_PER_DAY = 5;
const SESSION_MAX = 25;

async function rows(studentId: string) {
  return db.select().from(s.reviewCards).where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "flashcard")));
}

/** Due + new-today counts, for Today and the deck header. */
export async function flashcardStatus(studentId: string, now = new Date()) {
  const rs = (await rows(studentId)).filter((r) => BY_ID.has(r.itemId));
  const since = istDayStart(now).getTime();
  const due = rs.filter((r) => new Date(r.dueAt).getTime() <= now.getTime());
  // cards first seen today: one review so far, and it was today
  const introducedToday = rs.filter((r) => {
    const st = r.fsrsState as L.StoredCard;
    return st.reps <= 1 && st.last_review != null && new Date(st.last_review).getTime() >= since;
  }).length;
  const unseen = CARDS.length - rs.length;
  const newToday = Math.max(0, Math.min(NEW_PER_DAY - introducedToday, unseen));
  const upcoming = rs.filter((r) => new Date(r.dueAt).getTime() > now.getTime()).map((r) => new Date(r.dueAt).getTime());
  return {
    due: due.length,
    newToday,
    seen: rs.length,
    total: CARDS.length,
    nextDue: upcoming.length ? new Date(Math.min(...upcoming)).toISOString() : null,
    dueIds: due.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).map((r) => r.itemId),
    seenIds: new Set(rs.map((r) => r.itemId)),
  };
}

/** Today's session: due cards (oldest first), then new cards from the weakest concepts. */
export async function getSession(studentId: string, now = new Date()) {
  const [st, mastery] = await Promise.all([flashcardStatus(studentId, now), masteryMap(studentId)]);
  // weakest concepts first, but one card per concept per pass so a day's 5 aren't all one topic
  const unseen = CARDS.filter((c) => !st.seenIds.has(c.id));
  const groups = [...new Set(unseen.map((c) => c.conceptId))]
    .sort((a, b) => (mastery[a] ?? 0.5) - (mastery[b] ?? 0.5))
    .map((cid) => unseen.filter((c) => c.conceptId === cid));
  const fresh: Flashcard[] = [];
  for (let pass = 0; fresh.length < st.newToday && groups.some((g) => g.length > pass); pass++)
    for (const g of groups) if (g[pass] && fresh.length < st.newToday) fresh.push(g[pass]);
  const queue = [...st.dueIds.map((id) => BY_ID.get(id)!).filter(Boolean), ...fresh].slice(0, SESSION_MAX);
  return {
    cards: queue.map((c) => ({ ...c, conceptName: getConcept(c.conceptId).name, isNew: !st.seenIds.has(c.id) })),
    due: st.due,
    newToday: st.newToday,
    seen: st.seen,
    total: st.total,
    nextDue: st.nextDue,
  };
}

/** Again / Hard / Good / Easy → FSRS (same engine as concept reviews). */
export async function rateCard(studentId: string, cardId: string, rating: L.ReviewRating, now = new Date()) {
  if (!BY_ID.has(cardId)) return null;
  const [existing] = await db
    .select()
    .from(s.reviewCards)
    .where(and(eq(s.reviewCards.studentId, studentId), eq(s.reviewCards.itemType, "flashcard"), eq(s.reviewCards.itemId, cardId)));
  const next = L.review((existing?.fsrsState as L.StoredCard) ?? null, rating, now);
  await db
    .insert(s.reviewCards)
    .values({ studentId, itemType: "flashcard", itemId: cardId, fsrsState: next.card, dueAt: next.due })
    .onConflictDoUpdate({ target: [s.reviewCards.studentId, s.reviewCards.itemType, s.reviewCards.itemId], set: { fsrsState: next.card, dueAt: next.due } });
  return { dueAt: next.due.toISOString() };
}
