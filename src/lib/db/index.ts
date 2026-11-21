import "server-only";
import { getDb, hasDatabase, type DB } from "./client";

export * as schema from "./schema";
export { hasDatabase, getDb, type DB };

/**
 * Typed Drizzle client (Neon HTTP driver). Server-only.
 * Lazy: the connection is created on first property access, so importing this
 * module never throws at build time when DATABASE_URL is unset.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
