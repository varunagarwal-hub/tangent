import "server-only";

/**
 * Light in-memory rate limit for AI routes (per persona / student id, per minute).
 * Per serverless instance only: a guard against runaway loops, not abuse-proofing.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return b.count <= limit ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function tooMany(retryAfter: number) {
  return Response.json(
    { error: "You're going fast! Take a breath and try again in a moment." },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
