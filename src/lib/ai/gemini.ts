import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { AgentName, TraceStatus } from "@/lib/agents/trace";
import { getDb, hasDatabase } from "@/lib/db/client";
import { agentRuns } from "@/lib/db/schema";

/**
 * Gemini wrapper: JSON-schema structured output → Zod validation → one retry on
 * parse/validation failure → timeout → agent_runs logging → in-memory cache.
 *
 * Usable from route handlers, server actions and tsx scripts (no "server-only" import
 * so scripts can use it; it reads keys from process.env and never runs on the client).
 */

export type ModelTier = "fast" | "smart";

export function modelId(tier: ModelTier) {
  return tier === "fast"
    ? process.env.GEMINI_MODEL_FAST || "gemini-3.8-flash"
    : process.env.GEMINI_MODEL_SMART || "gemini-3.1-pro-preview";
}

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

let ai: GoogleGenAI | null = null;
function client() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export interface ImageInput {
  /** base64 without the data: prefix */
  data: string;
  mimeType: string;
}

export interface StructuredCall<S extends z.ZodType> {
  agent: AgentName;
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: S;
  images?: ImageInput[];
  studentId?: string | null;
  /** short description for agent_runs.input_summary */
  inputSummary?: string;
  timeoutMs?: number;
  temperature?: number;
  cache?: boolean;
}

export interface StructuredResult<T> {
  data: T;
  ms: number;
  status: TraceStatus;
  attempts: number;
}

const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(c: StructuredCall<z.ZodType>) {
  const h = createHash("sha256");
  h.update(c.agent + c.tier + c.system + c.prompt);
  for (const img of c.images ?? []) h.update(img.data);
  return h.digest("hex");
}

function stripFences(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** JSON schema for Gemini from a Zod schema (drops keys Gemini doesn't accept). */
function toGeminiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * Call Gemini with structured output. Throws on final failure — callers decide the
 * fallback (bank content, "I'm not sure" copy, etc.).
 */
export async function generateStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<StructuredResult<z.infer<S>>> {
  const started = Date.now();
  const key = call.cache === false ? null : cacheKey(call);
  if (key) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { data: hit.data as z.infer<S>, ms: 0, status: "ok", attempts: 0 };
    }
  }

  const parts: Part[] = [
    ...(call.images ?? []).map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
    { text: call.prompt },
  ];
  const responseJsonSchema = toGeminiSchema(call.schema);

  let lastError: unknown = null;
  let attempts = 0;
  for (let i = 0; i < 2; i++) {
    attempts++;
    try {
      const res = await client().models.generateContent({
        model: modelId(call.tier),
        contents: [
          {
            role: "user",
            parts:
              i === 0
                ? parts
                : [
                    ...parts,
                    { text: `Your previous reply was invalid (${String(lastError).slice(0, 300)}). Reply ONLY with JSON matching the schema.` },
                  ],
          },
        ],
        config: {
          systemInstruction: call.system,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: call.temperature ?? 0.4,
          abortSignal: AbortSignal.timeout(call.timeoutMs ?? 25_000),
        },
      });
      const text = stripFences(res.text ?? "");
      const parsed = call.schema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error(`schema: ${parsed.error.message}`);
      const ms = Date.now() - started;
      if (key) cache.set(key, { data: parsed.data, at: Date.now() });
      void logRun({ agent: call.agent, studentId: call.studentId, inputSummary: call.inputSummary, output: parsed.data, ms, status: "ok" });
      return { data: parsed.data, ms, status: "ok", attempts };
    } catch (err) {
      lastError = err instanceof Error ? err.message : err;
      // Don't retry timeouts/aborts — the caller should fall back fast.
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) break;
    }
  }

  const ms = Date.now() - started;
  void logRun({ agent: call.agent, studentId: call.studentId, inputSummary: call.inputSummary, output: { error: String(lastError) }, ms, status: "error" });
  throw new Error(`[${call.agent}] Gemini failed after ${attempts} attempt(s): ${String(lastError)}`);
}

/** Fire-and-forget log to agent_runs. Never throws. */
export async function logRun(r: {
  agent: AgentName;
  studentId?: string | null;
  inputSummary?: string;
  output: unknown;
  ms: number;
  status: TraceStatus;
}) {
  try {
    if (!hasDatabase()) return;
    await getDb()
      .insert(agentRuns)
      .values({
        agent: r.agent,
        studentId: r.studentId ?? null,
        inputSummary: r.inputSummary?.slice(0, 500) ?? null,
        output: r.output,
        latencyMs: Math.round(r.ms),
        status: r.status,
      });
  } catch {
    /* logging must never break a request */
  }
}
