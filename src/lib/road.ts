import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CONCEPTS, getConcept, getMisconception } from "@/lib/content";
import { scoreCandidates } from "@/lib/agents/planner";
import { computeStreak, istDate } from "@/lib/daily";
import { dueCards, masteryMap } from "@/lib/repo";

const s = schema;
const DAY = 86_400_000;
const WEAK = 0.4;
const SOLID = 0.7;

export interface RoadPhase {
  key: "foundations" | "coverage" | "sectionals" | "mocks" | "taper";
  title: string;
  start: string; // YYYY-MM-DD
  end: string;
  weeks: number;
  focus: string[];
  current: boolean;
  done: boolean;
}
export interface WeekDay {
  date: string;
  label: string; // Mon 24
  today: boolean;
  past: boolean;
  items: { text: string; href: string; minutes: number }[];
  activity: number; // questions + games done that day
}

/** The next CAT (last Sunday of November) if the student hasn't set an exam date. */
function defaultExamDate(now: Date) {
  for (let y = now.getUTCFullYear(); ; y++) {
    const d = new Date(Date.UTC(y, 10, 30));
    d.setUTCDate(30 - d.getUTCDay());
    if (d.getTime() > now.getTime() + 14 * DAY) return d;
  }
}

/**
 * Five phases from today to the exam, sized to the time left (deterministic):
 * foundations & weak spots → full syllabus → weekly sectionals → full mocks + revision → 2-week taper.
 */
export function buildPhases(now: Date, exam: Date, weak: string[], untouched: string[]): RoadPhase[] {
  const days = Math.max(1, Math.ceil((exam.getTime() - now.getTime()) / DAY));
  const taper = Math.min(14, Math.max(3, Math.round(days * 0.15)));
  const rest = days - taper;
  const share = weak.length || untouched.length ? [0.15, 0.4, 0.2, 0.25] : [0.05, 0.4, 0.25, 0.3];
  const lens = share.map((x) => Math.max(rest > 40 ? 7 : 1, Math.round(rest * x)));
  // fix rounding so the four add up to `rest`
  lens[3] += rest - lens.reduce((a, b) => a + b, 0);
  if (lens[3] < 1) {
    lens[1] += lens[3] - 1;
    lens[3] = 1;
  }
  const defs: Omit<RoadPhase, "start" | "end" | "weeks" | "current" | "done">[] = [
    {
      key: "foundations",
      title: "Foundations & weak spots",
      focus: [
        weak.length ? `Fix first: ${weak.slice(0, 4).join(", ")}` : "No weak concepts right now: a quick foundation check, then move on",
        untouched.length ? `Take a first look at ${untouched.length} concept${untouched.length > 1 ? "s" : ""} you haven't tried` : "Every concept has been tried at least once",
        "Foundation check for school-maths gaps",
      ],
    },
    {
      key: "coverage",
      title: "Full syllabus coverage",
      focus: ["Every concept to 70% mastery, heaviest CAT topics first", "Concept cards before practice on anything new", "Daily: due reviews + one game"],
    },
    {
      key: "sectionals",
      title: "Weekly sectional mocks",
      focus: ["One 40-minute QA mock every Saturday", "Skip Coach debrief after each: fix the skip rule, not just the maths", weak.length ? `Extra revision slots for ${weak.slice(0, 3).join(", ")}` : "Stretch questions on strong topics"],
    },
    {
      key: "mocks",
      title: "Full mocks + revision cycles",
      focus: ["Two sectional mocks a week, timed strictly", "Revision cycle: one area per day, all five every week", "Formula flashcards daily"],
    },
    {
      key: "taper",
      title: "Final two weeks: light revision",
      focus: ["No new topics", "Formula cards and your Mistake Journal", "One last mock, then rest the day before"],
    },
  ];
  let cursor = new Date(now);
  const allLens = [...lens, taper];
  return defs.map((d, k) => {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + (allLens[k] - 1) * DAY);
    cursor = new Date(end.getTime() + DAY);
    return { ...d, start: istDate(start), end: istDate(end), weeks: Math.max(1, Math.round(allLens[k] / 7)), current: k === 0, done: false };
  });
}

/** Questions + games per IST day, oldest first, for the last `weeks` weeks (ending this week). */
async function activityByDay(studentId: string) {
  const res = await db.execute(sql`
    select d, sum(n)::int as n from (
      select to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d, count(*) as n from attempts where student_id = ${studentId} group by 1
      union all
      select to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d, count(*) as n from game_scores where student_id = ${studentId} group by 1
    ) x group by d`);
  return new Map(((res as unknown as { rows: { d: string; n: number }[] }).rows ?? []).map((r) => [r.d, r.n]));
}

export async function getRoad(studentId: string, now = new Date()) {
  const [[student], mastery, cands, due, byDay, [{ total }]] = await Promise.all([
    db.select().from(s.students).where(eq(s.students.id, studentId)),
    masteryMap(studentId),
    scoreCandidates(studentId),
    dueCards(studentId, now),
    activityByDay(studentId),
    db.select({ total: sql<number>`count(*)::int` }).from(s.attempts).where(eq(s.attempts.studentId, studentId)),
  ]);
  const exam = student?.examDate ? new Date(`${student.examDate}T09:00:00+05:30`) : defaultExamDate(now);
  const dailyMinutes = student?.dailyMinutes ?? 60;
  const weak = CONCEPTS.filter((c) => mastery[c.id] != null && mastery[c.id] < WEAK).sort((a, b) => b.weight - a.weight).map((c) => c.name);
  const untouched = CONCEPTS.filter((c) => mastery[c.id] == null).map((c) => c.name);
  const solid = CONCEPTS.filter((c) => (mastery[c.id] ?? 0) >= SOLID).length;
  const phases = buildPhases(now, exam, weak, untouched);

  /* this week, Mon–Sun in IST */
  const todayStr = istDate(now);
  const istNow = new Date(now.getTime() + 5.5 * 3600_000);
  const dow = (istNow.getUTCDay() + 6) % 7; // Mon = 0
  const monday = new Date(now.getTime() - dow * DAY);
  const moves = cands.slice(0, 7);
  const mocksNow = weak.length === 0 && untouched.length < 5; // a weekly Saturday mock once the syllabus is tried and nothing is below 40%
  const week: WeekDay[] = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(monday.getTime() + k * DAY);
    const date = istDate(d);
    const items: WeekDay["items"] = [];
    if (date === todayStr && untouched.length >= 20) items.push({ text: "Take the 12-question diagnostic", href: "/diagnostic", minutes: 25 });
    if (date === todayStr && due.length) items.push({ text: `Clear ${due.length} due review${due.length > 1 ? "s" : ""}`, href: "/practice?mode=review", minutes: Math.min(20, due.length * 3) });
    const m = moves.length ? moves[k % moves.length] : null;
    if (m) {
      const mc = getMisconception(m.misconceptionId);
      const c = getConcept(m.conceptId);
      const text = m.kind === "contrast_question" && mc ? `Fix "${mc.name}"` : m.kind === "prerequisite_drill" ? `Shore up ${c.name}` : m.kind === "review" ? `Revise ${c.name}` : m.kind === "stretch" ? `Stretch on ${c.name}` : `Practise ${c.name}`;
      items.push({ text, href: `/practice?concept=${c.id}`, minutes: Math.round(dailyMinutes * 0.5) });
      if (mastery[c.id] != null && mastery[c.id] < WEAK) items.push({ text: `Read the ${c.name} card`, href: `/learn/${c.id}`, minutes: 10 });
    }
    if (k === 5 && mocksNow) items.push({ text: "Sectional mock (40 min)", href: "/mock", minutes: 50 });
    else items.push({ text: k % 2 ? "Spot the Tangent" : "Speed sprint", href: k % 2 ? "/play/spot" : "/play/sprint", minutes: 5 });
    return {
      date,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", timeZone: "Asia/Kolkata" }).format(d),
      today: date === todayStr,
      past: date < todayStr,
      items,
      activity: byDay.get(date) ?? 0,
    };
  });

  /* heatmap: last 26 weeks ending this Sunday */
  const WEEKS = 26;
  const firstMonday = new Date(monday.getTime() - (WEEKS - 1) * 7 * DAY);
  const cells = Array.from({ length: WEEKS * 7 }, (_, k) => {
    const date = istDate(new Date(firstMonday.getTime() + k * DAY));
    return { date, n: byDay.get(date) ?? 0, future: date > todayStr };
  });
  const activeDates = [...byDay.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of activeDates) {
    run = prev && istDate(new Date(new Date(`${prev}T12:00:00Z`).getTime() + DAY)) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const { streak } = await computeStreak(studentId, student?.streakDays ?? 0, now);

  return {
    name: student?.name ?? "there",
    examDate: istDate(exam),
    examSet: !!student?.examDate,
    daysLeft: Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / DAY)),
    dailyMinutes,
    coverage: { solid, total: CONCEPTS.length },
    weak,
    phases,
    week,
    heatmap: { weeks: WEEKS, cells, max: Math.max(1, ...cells.map((c) => c.n)) },
    totals: { questions: total, activeDays: byDay.size, longest: Math.max(longest, streak), streak },
  };
}

export type Road = Awaited<ReturnType<typeof getRoad>>;
