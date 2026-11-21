# Tangent — project guide for Claude Code

**Read `MASTER_PLAN.md` and `PROGRESS.md` before doing anything.** PROGRESS.md is the source of truth for what's done.

Tangent is an adaptive CAT Quant tutor (hackathon: Product Space Agentic AI, PS2). It reads a student's rough work (typed, drawn, or photographed), finds the exact line where the reasoning went "off on a tangent", and rebuilds their prep around it. Deadline: 21 Nov 2026, 11:30 PM IST.

## Working rules
1. After every task: update `PROGRESS.md`, then `git commit` with a clear message. Push after every phase.
2. Never commit `.env*` (except `.env.example`). Keep `.env.example` current.
3. Work phase by phase (MASTER_PLAN §12). Don't start P1 while a P0 is broken.
4. `npm run build` must pass at the end of every phase.
5. Ask the human only when truly blocked; otherwise decide and log it in PROGRESS.md → Decisions.
6. Math in code, judgment in AI: mastery (BKT), difficulty (Elo), scheduling (FSRS) are deterministic in `src/lib/learner/`. LLMs only read, diagnose, write, explain, plan language.

## Stack
Next.js 16 (App Router, TS, `src/`), Tailwind v4, shadcn/ui + Magic UI (in `src/components/ui`), GSAP + @gsap/react, Motion, Lenis (landing only), rough-notation, roughjs, @xyflow/react, Recharts, KaTeX, perfect-freehand, Neon Postgres (`@neondatabase/serverless`, neon-http) + Drizzle ORM (server only, no RLS, no auth; persona via cookie), Vercel Blob for images, Gemini via `@google/genai` (structured JSON + Zod + 1 retry), ts-fsrs, vitest, tsx scripts.

Note: this Next.js version has breaking changes vs. older training data — check `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## Layout
- `src/lib/ai/gemini.ts` — `generateStructured()` wrapper (schema → JSON → Zod, retry, timeout, logs to `agent_runs`)
- `src/lib/db/schema.ts` — Drizzle schema (13 tables). `src/lib/db/index.ts` exports server-only `db`; `src/lib/db/client.ts` has `getDb()` for tsx scripts
- `src/lib/storage.ts` — `uploadRoughWork()` → Vercel Blob URL, or null if no token (then image goes straight to Gemini, `work_image_url` null). Client compression: `src/lib/compress-image.ts`
- `src/lib/agents/` — the 7 agents; prompts in `src/lib/agents/prompts/`
- `src/lib/learner/` — BKT, Elo, calibration, FSRS mapping (+ tests)
- `data/` — concepts.json, misconceptions.json, questions.json, evals/
- `drizzle.config.ts` — `npm run db:push` (create/sync tables), `db:generate`, `db:studio`
- `scripts/` — seed-content.ts, seed-db.ts, eval-detective.ts (run with `npx tsx`)

## Env vars
`GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `DATABASE_URL` (Neon pooled), `BLOB_READ_WRITE_TOKEN` (see `.env.example`). AI routes: `export const maxDuration = 60`. Never expose keys to the client.

## Design
"Graph paper & red pen" — tokens live in `src/app/globals.css` as CSS variables (paper, ink, red-pen, highlighter, mastery scale, chalkboard dark mode). Fonts: Instrument Serif (`font-serif`), Geist (`font-sans`), Caveat (`font-hand`), JetBrains Mono (`font-mono`). No purple gradients, no glassmorphism. Respect reduced motion.
