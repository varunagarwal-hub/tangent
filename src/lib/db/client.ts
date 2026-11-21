/**
 * Drizzle client factory without the "server-only" guard, so tsx scripts
 * (seed, eval) can share it. App code should import from "@/lib/db" instead.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

let instance: DB | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): DB {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing (Neon pooled connection string)");
  instance = drizzle(neon(url), { schema });
  return instance;
}
