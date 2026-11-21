import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { sql } from "drizzle-orm";
async function main() {
  const { getDb } = await import("../src/lib/db/client");
  const { RIYA_ID } = await import("../src/lib/personas");
  const db = getDb();
  const q = async (label: string, query: ReturnType<typeof sql>) => console.log(`\n${label}`, (await db.execute(query)).rows);
  await q("Top class misconceptions (students affected, active):", sql`select misconception_id, count(*)::int n, count(*) filter (where status <> 'resolved')::int active from misconception_events e join students s on s.id = e.student_id where s.is_synthetic group by 1 order by 2 desc limit 6`);
  await q("Class avg mastery by area:", sql`select c.area, round(avg(m.p_mastery)::numeric, 2) avg from mastery m join concepts c on c.id = m.concept_id join students s on s.id = m.student_id where s.is_synthetic group by 1 order by 2`);
  await q("Riya mastery (A-chain + algebra):", sql`select concept_id, round(p_mastery::numeric,2) p, attempts from mastery where student_id = ${RIYA_ID} order by concept_id`);
  await q("Riya misconceptions:", sql`select misconception_id, status, evidence_count from misconception_events where student_id = ${RIYA_ID}`);
  await q("Riya attempts / days active:", sql`select count(*)::int attempts, count(distinct date(created_at at time zone 'Asia/Kolkata'))::int days from attempts where student_id = ${RIYA_ID}`);
  await q("Question elo spread:", sql`select min(difficulty_elo)::int, max(difficulty_elo)::int, round(avg(difficulty_elo))::int avg, sum(attempts_count)::int attempts from questions`);
  await q("Low-confidence diagnoses with work (override queue):", sql`select count(*)::int from attempts where work_text is not null and (diagnosis->>'confidence')::float < 0.6`);
}
main();
