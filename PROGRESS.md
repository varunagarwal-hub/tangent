# Tangent — Progress

Last updated: Phase 0 complete; Neon, Vercel Blob and Vercel project are wired up. Gemini key works on both models (local + Vercel). Next: Phase 1. Keep this file true at every commit.

## Done
### Phase 0 — Setup ✅
- [x] P0.1 Scaffold Next.js 16 (App Router, TS, src/, Tailwind v4) + git init
- [x] P0.2 shadcn/ui init + base components; Magic UI (number-ticker, animated-beam, bento-grid, border-beam, blur-fade)
- [x] P0.3 Install stack deps (gsap, motion, lenis, rough-notation, roughjs, xyflow, recharts, katex, perfect-freehand, @neondatabase/serverless, drizzle-orm, drizzle-kit, @vercel/blob, genai, zod, ts-fsrs, vitest, tsx)
- [x] P0.4 CLAUDE.md, PROGRESS.md, .env.example
- [x] P0.5 Fonts + design tokens (paper grid, ink, red pen, highlighter, mastery scale, chalkboard dark mode) + Logo SVG (`src/components/brand/logo.tsx`) + favicon (`src/app/icon.svg`) + theme toggle. Checked visually in both themes.
- [x] P0.6 Drizzle schema `src/lib/db/schema.ts` (13 tables, same columns/indexes as the old SQL). `src/lib/db/index.ts` (server-only lazy `db`), `src/lib/db/client.ts` (`getDb()` for scripts), `drizzle.config.ts`, scripts `db:push` / `db:generate` / `db:studio`.
- [x] P0.7 Gemini wrapper `src/lib/ai/gemini.ts`: `generateStructured()` (Zod → JSON schema → `responseJsonSchema`, Zod validation, 1 retry with error feedback, 25s timeout, 10-min cache, `agent_runs` logging via Drizzle; logging is skipped if no DATABASE_URL). Trace type `src/lib/agents/trace.ts`.
- [x] P0.8 `npm run build` passes; pushed to GitHub (private repo)
- [x] P0.10 Infra wired: Neon project `tangent` (id `falling-scene-06569260`, aws-ap-southeast-1, PG17); `npm run db:push` done, 13 tables confirmed. Vercel project `tangent` (team varun-s-workspace) linked and connected to GitHub `varunagarwal-hub/tangent` (pushes to main auto-deploy). Blob store `tangent-rough-work` (public, sin1) connected to all envs. Vercel env: DATABASE_URL, BLOB_READ_WRITE_TOKEN, GEMINI_MODEL_FAST/SMART set for production/preview/development. `/api/health` reports DB/blob/Gemini wiring.
- [x] P0.9 Image storage: `src/lib/storage.ts` (`uploadRoughWork()` → Vercel Blob URL, or null when BLOB_READ_WRITE_TOKEN is missing/fails), `src/lib/compress-image.ts` (client-side, ≤1600px JPEG, <4MB).

### Phase 1 — Content & learner model (in progress)
- [x] `data/concepts.json` (27 nodes, weights, target times)
- [x] Learner model `src/lib/learner/` (bkt, elo, calibration, fsrs, index → `applyAttempt()` + `stepMisconception()` lifecycle). 21 vitest tests + 3 grading tests pass (`npm test`).
- [x] `src/lib/grading.ts` deterministic answer matching (₹, commas, units, LaTeX fractions, option letters)
- [x] Generator + verifier agents (`src/lib/agents/generator.ts`, `verifier.ts`, prompts in `prompts/`): `generateVerified()` loop, max 2 retries with rejection reason, trace steps
- [x] `src/lib/content.ts` (typed access to concepts/misconceptions), `src/lib/personas.ts` (fixed Riya/Mehta/class UUIDs)
- [x] `data/anchor-questions.json`: 5 hand-written demo questions (successive discounts, avg speed, time & work, similar-triangle area, successive %) with tagged distractors
- [x] `scripts/seed-content.ts` (resumable, concurrency 4, logs rejections to `data/questions-rejections.json`) and `scripts/seed-db.ts` (wipe + load + simulate 30 synthetic students + Riya through `applyAttempt`)

## In progress
- [ ] `data/misconceptions.json` (~75), `data/fewshot-seed.json`, `data/evals/detective.json`: being written by a subagent
- [ ] Run seed-content (60 + 5 anchors), then seed-db; build; push

## Next

### Phase 2 — Core student loop
- [ ] /diagnostic (adaptive 12 Q), work input tabs (scratchpad / type / upload / sample)
- [ ] Detective agent + transcription confirm + red-pen annotation
- [ ] Planner + "Why this?"; /practice
- [ ] Pre-verified pool + background generator/verifier
- [ ] Agent trace panel

### Phase 3 — Map, reveal, today, review → DEPLOY
- [ ] /map (React Flow, fade by due-ness, node drawer)
- [ ] /reveal (GSAP sequence)
- [ ] /today, review queue, /mistakes journal lifecycle
- [ ] Deploy to Vercel, test Riya path live

### Phase 4 — Teacher dashboard
- [ ] Heatmap, leaderboard, lesson plan, drill-down, override queue → few-shot, assignments + impact

──── CUT LINE A ────

### Phase 5 — P1 polish
- [ ] Landing animations, Skip Coach + calibration, "That's not why" loop, /under-the-hood + eval score, mobile pass, reduced motion, loading/error states

──── CUT LINE B ────

### Phase 6 — P2
- [ ] Mistake Fingerprint card, Sprint mode, bank → 150, Hinglish toggle

### Phase 7 — Submission (start by 10:30 PM)
- [ ] README, final deploy, live + mobile route check

## Known bugs
- (none yet)

## Decisions
- Next.js 16.4 / React 19.3 / Tailwind v4 (latest stable from create-next-app).
- Gemini model IDs (from ai.google.dev models page, Nov 2026): FAST=`gemini-3.8-flash`, SMART=`gemini-3.1-pro-preview` (latest Pro is still preview). Override via env.
- `@types/node` bumped to ^24 to satisfy vitest 5 peer dep.
- Magic UI components live in `src/components/ui/` (shadcn default path).
- **Switched from Supabase to Neon + Drizzle + Vercel Blob** (human's call, before Phase 1). Neon via neon-http driver (no transactions over HTTP; use `db.batch()` if atomic multi-writes are needed). No RLS: the DB is only touched from server code. Images: Vercel Blob; if no token, the image goes straight to Gemini and only the transcription is stored (`work_image_url` = null).
- drizzle-kit pulls an old nested esbuild whose binary fails to install here (Windows path length in the deep workspace folder). Fixed with `overrides["@esbuild-kit/core-utils"].esbuild = 0.28.2` in package.json, which reuses the hoisted esbuild.
- Vercel CLI quirks: `vercel env pull` / `blob create-store` rewrite `.env.local` (comments lost, sensitive vars come back empty). After any pull, re-check DATABASE_URL locally. `vercel env add` with `--value` saved an empty value once; pipe the value on stdin with `--environment <env>` instead. `vercel link` appends `.env*` to .gitignore; removed so `.env.example` stays tracked.
- Gemini client is pinned to `apiVersion: "v1beta"`: preview models (the Pro preview) 404 on v1. `npx tsx scripts/check-gemini.ts` smoke-tests both tiers (both pass).
- Learner-model interpretations: "correct but slow → 70% toward the correct update" = p + 0.7·(p_correct − p). Calibration stored per concept as an EMA (α 0.2) of (confidence value − correctness); positive = overconfident. FSRS Easy = correct, ≤0.75× target time and "Certain". ts-fsrs v6 has no `get_retrievability`, so `retrievability()` uses the FSRS-6 curve directly (decay 0.1542).
- Bank question Elo starts at band centre (easy 1050 / medium 1250 / hard 1450); seed-db then recalibrates it from the simulated class's attempts.
- Riya's seeded state: A1_ADD_SUCCESSIVE active ("fixing"); A4_ADD_DISCOUNTS deliberately absent so the demo detects it live.
- `cacheComponents` is on in Next 16: use `await connection()` instead of `export const dynamic`.
- `db` in `@/lib/db` is a lazy Proxy so `next build` works without DATABASE_URL.

## Human tasks
1. [x] (done by Claude) Create a Neon project (or add Neon from Vercel's Storage tab); paste the pooled `DATABASE_URL` into `.env.local` (and Vercel env vars). Then Claude runs `npm run db:push`.
2. [x] (done by Claude) Create a Vercel Blob store; paste `BLOB_READ_WRITE_TOKEN` into `.env.local` and Vercel.
3. [x] Add `GEMINI_API_KEY` (+ model IDs) to `.env.local` and Vercel.
4. [ ] Hand-write 3–4 wrong solutions (successive discounts added; avg speed = mean of speeds; adding days in time & work; area ratio not squared), photograph, save as `public/samples/sample-1.jpg` …
5. [x] (done by Claude) Connect GitHub repo to Vercel.
6. [ ] Record 2–3 min demo video; LinkedIn posts at milestones.
