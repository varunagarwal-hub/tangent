import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db, hasDatabase } from "@/lib/db";
import { hasBlobStorage } from "@/lib/storage";
import { hasGemini, modelId } from "@/lib/ai/gemini";

/** Wiring check: which services are configured. Never returns secrets. */
export async function GET() {
  await connection(); // render per request (cacheComponents forbids `export const dynamic`)
  let database: { ok: boolean; tables?: number; error?: string } = { ok: false };
  if (hasDatabase()) {
    try {
      const r = await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
      database = { ok: true, tables: Number((r.rows[0] as { n: number }).n) };
    } catch (e) {
      database = { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "query failed" };
    }
  }
  return Response.json({
    database,
    blob: hasBlobStorage(),
    gemini: { configured: hasGemini(), fast: modelId("fast"), smart: modelId("smart") },
  });
}
