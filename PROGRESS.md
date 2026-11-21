# Tangent — Progress

Last updated: Phase 8 UX pass done (fonts, welcome tour + role picker, page intros, info tips, guided demo, session recap, reset demo); built, checked desktop + 375px, deployed. Riya reset via /api/demo/reset. Human: demo video.

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

### Phase 1 — Content & learner model ✅
- [x] `data/concepts.json` (27 nodes, weights, target times)
- [x] Learner model `src/lib/learner/` (bkt, elo, calibration, fsrs, index → `applyAttempt()` + `stepMisconception()` lifecycle). 21 vitest tests + 3 grading tests pass (`npm test`).
- [x] `src/lib/grading.ts` deterministic answer matching (₹, commas, units, LaTeX fractions, option letters)
- [x] Generator + verifier agents (`src/lib/agents/generator.ts`, `verifier.ts`, prompts in `prompts/`): `generateVerified()` loop, max 2 retries with rejection reason, trace steps
- [x] `src/lib/content.ts` (typed access to concepts/misconceptions), `src/lib/personas.ts` (fixed Riya/Mehta/class UUIDs)
- [x] `data/anchor-questions.json`: 5 hand-written demo questions (successive discounts, avg speed, time & work, similar-triangle area, successive %) with tagged distractors
- [x] `scripts/seed-content.ts` (resumable, concurrency 4, logs rejections to `data/questions-rejections.json`) and `scripts/seed-db.ts` (wipe + load + simulate 30 synthetic students + Riya through `applyAttempt`)

- [x] `data/misconceptions.json` (82: A1–A8 ≥4 each, every concept ≥2, all 23 demo-critical ids), `data/fewshot-seed.json` (23, one per demo-critical id), `data/evals/detective.json` (20 labeled cases, 15 misconceptions, 2 right-answer/wrong-reasoning; none for M1/N-series yet)
- [x] `data/questions.json`: 64 verified questions (5 anchors + 59 generated; every concept ≥1, arithmetic 39). Verifier rejected 29 drafts (≈31% rejection rate, logged in `data/questions-rejections.json`, incl. a few generator timeouts/"verifier unavailable"): wrong keys, non-integer people counts, typos, no correct option.
- [x] Neon seeded (`npx tsx scripts/seed-db.ts`): 32 people (Riya, Prof. Mehta, 30 synthetic), 1,959 attempts, 638 mastery rows, 1,002 review cards, 370 misconception events, 64 questions (Elo recalibrated from the simulated class: 1055–1450), A3 assignment (5 days ago) with baseline + post-assignment lift, 28 low-confidence diagnoses with work for the override queue. Class top gaps: A1_ADD_SUCCESSIVE (18 students), A3_AVG_OF_AVGS (17), A8_MEAN_OF_SPEEDS (15).
- [x] Riya: A1 0.17 / A4 0.20 weak; A2, A3, algebra ≥0.9; A1_ADD_SUCCESSIVE "fixing" (4 evidence) + 2 minor detected; 48 attempts over 10 days; 6-day streak; 4 reviews due.
- [x] `scripts/inspect-seed.ts` prints the seeded story (class gaps, area mastery, Riya's state).

## In progress
- (nothing)

## Next

### Phase 2 — Core student loop ✅
- [x] Project moved to `C:\Users\varun\hackathon tangent\tangent` (git re-linked to origin, `.env.local` re-pulled from Vercel development, packages reinstalled)
- [x] UI kit `src/components/tangent/` (math-text, scratchpad, work-input, red-pen-work, trace-panel/TraceDock, pen-loader, timer, confidence-picker, question-card, app-header, mini-map) + `/kit` preview page
- [x] Persona cookie: `src/lib/session.ts` (`getPersona`, defaults to Riya), `POST /api/persona` (riya | mehta | new → creates a student)
- [x] Data layer `src/lib/repo.ts`: pickQuestion (Elo band, contrast targeting, recent-exclusion), recordAttempt (applyAttempt + parallel writes + question calibration/retire), applyDiagnosis (flawed-correct half credit, lifecycle), stepLifecycle, dueCards, fewshotFor (teacher first)
- [x] `POST /api/attempt`: instant grading, no AI (~350–400ms warm in dev)
- [x] Detective `src/lib/agents/detective.ts`: Gemini Pro vision transcription → numbered lines; Flash (thinking LOW) diagnosis with candidates + few-shot + distractor hint + confidently-wrong hint + student note; confidence < 0.5 → "I'm not sure, tell me your approach"
- [x] `POST /api/detective`: NDJSON stream of trace steps; image → Blob upload + transcribe → pause for "Here's what I read" confirm (unless quick); deterministic fallback from tagged distractor if Gemini fails; "That's not why" logs `feedback`
- [x] Eval `scripts/eval-detective.ts` → `data/evals/results.json`: 20/20 misconception + error line, avg 3.6s (clean typed cases; real handwriting will be harder)
- [x] Planner `src/lib/agents/planner.ts`: deterministic scorer (contrast / prerequisite drill / review / practice / stretch + variety penalty) + Flash one-line "Why this?" (template fallback); `GET /api/next` + background pool refill via `after()` (`src/lib/pool.ts`, ≥3 per concept×band). Verified: a refill-generated question was served on the next call.
- [x] Diagnostician `src/lib/agents/diagnostician.ts`: high-weight roots first, step down to a prerequisite after a miss, then max weight×uncertainty; `POST /api/diagnostic/next`, `POST /api/diagnostic/summary`; `GET /api/mastery`
- [x] `/practice` and `/diagnostic` pages, checked in the browser (Riya: contrast question → trap option → line 2 circled "Adds successive percentage changes"; new student: diagnostic Q1 → mastery 30%→67%, mini map)

### Phase 3 — Map, reveal, today, review ✅
- [x] APIs: `GET /api/map` (MapData: nodes with p, opacity/retrievability, dueAt, active-misconception flag; prerequisite edges), `GET /api/concept/[id]` (history, attempts, misconceptions, 30-day forgetting curve, prerequisites). Server views in `src/lib/views.ts` (map, concept detail, today, journal).
- [x] `/map` (subagent): React Flow, deterministic 5-column layout, paper-card nodes with mastery ring, fade by due-ness, due badge, red dot for active misconception, dashed red edges for weak foundations, Sheet drawer with mastery-over-time + forgetting-curve charts. Files in `src/app/(app)/map/`, `src/components/tangent/map/`.
- [x] `/reveal` (subagent): GSAP SplitText headline → DrawSVG edges → nodes pop + fill → red-pen "Start here" circle → top-3 misconception cards → summary + CTA; Skip/Replay; reduced-motion path; works without sessionStorage (Riya). Timeline ≈ 8–9s at real speed (not watched at full speed: hidden pane throttles rAF).
- [x] `/today`: next best move (deterministic planner reason), due reviews → `/practice?mode=review` (planner `mode: "review"`), streak / days to CAT / minutes, mastery by area bars, journal preview. 375px checked.
- [x] `/mistakes`: Mistake Journal (active / resolved, lifecycle chips, tangent-point line + explanation, clean-answer dots, red-pen tick, example)
- [x] `/onboarding` (3 steps → `POST /api/profile` → /diagnostic); interim landing `/` with persona buttons (Riya, Prof. Mehta, new student)

### Phase 4 — Teacher dashboard ✅
- [x] Server `src/lib/teacher.ts`: class data (heatmap + class-average row, KPIs, relative at-risk with reasons, leaderboard with 7-day trend, override queue of low-confidence diagnoses with work, assignments with lift), student drill-down, `relabelAttempt` (confirm/relabel → `feedback` + teacher `fewshot_examples` + lifecycle fix-up), `createAssignment` (≤10 bank questions, baseline = class avg now)
- [x] Teacher Analyst `src/lib/agents/teacher-analyst.ts`: deterministic top-3 gaps, student groups by dominant gap (+ "ready to stretch"), 10-question set from bank traps; Gemini Pro (thinking LOW) writes why / worked example (wrong vs right) / teaching move; library fallback; ~17s
- [x] APIs: `GET /api/teacher/class`, `GET /api/teacher/student/[id]`, `POST /api/teacher/relabel`, `POST /api/teacher/assign`, `POST /api/teacher/lesson-plan`
- [x] `/teacher` UI (subagent; `src/app/(app)/teacher/`, `src/components/tangent/teacher/`): KPI row, sortable heatmap (scrolls inside card, % in cells), leaderboard, lesson plan as a marked-up notebook page + "Assign this set" + trace, override queue (confirm/relabel, badge increments), assignments impact, student drill-down sheet. Checked light/dark, desktop/375px.
- [x] Seed fixes: assignment baseline from mastery history at assignment time (A3 lift now +13 pts); seeded override-queue work shows the problem it was written for (`diagnosis.workQuestion`)

──── CUT LINE A ────

### Phase 5 — P1 polish
- [x] Landing `/`: GSAP hero (SplitText headline, DrawSVG tangent scene), looping red-pen demo (3 real mistakes), bento features (Magic UI), mini animated concept graph, how-it-works, CTA, Lenis smooth scroll (landing only). Components in `src/components/landing/`.
- [x] `/strategy`: Skip Coach replay (+3/−1, TITA no negative), calibration by confidence/area, Sprint mode toggle (P2 done here too)
- [x] `/under-the-hood`: architecture diagram, counts, 7 agent cards with live runs/latency/errors, detective eval (20/20), verifier rejection rate + reasons, algorithms, feedback loops, live agent feed (15s refresh). `outputFileTracingIncludes` ships the data JSON for its API on Vercel.
- [x] "That's not why" loop (Phase 2), branded 404/error pages, per-persona rate limits on AI routes, 375px pass (no horizontal overflow on landing, practice, today, mistakes, onboarding, teacher, reveal, strategy, under-the-hood), reduced-motion paths (GSAP matchMedia)
- [x] Skip Coach copy no longer leaks "Rule A / Rule B" prompt labels

### Phase 8 — UX & clarity pass (approved by human, ~9 PM)
- [x] Font/readability: Caveat only for short accents ≥ 20px; small labels + paragraphs (Skip Coach, "Why this?", agent notes) in Geist; `.margin-note` is now readable UI type with a red-pen rule; uppercase labels bigger; dark-mode soft ink lighter
- [x] Math: plain numbers/%/₹/units in `$…$` render as text (no KaTeX serif mid-sentence); variables and real formulas stay KaTeX (`asPlainText` in math-text.tsx)
- [x] Welcome tour with role picker (I'm a student / I'm a teacher), auto on first visit to /, reopen from Help menu (`src/components/tangent/welcome/`)
- [x] Plain-language page intros (`PageIntro`, dismissable) on today, practice, map, mistakes, strategy, teacher; diagnostic subtitle
- [x] Hover/tap explanations (`InfoTip` + `src/lib/glossary.ts`) on mastery, reviews, next move, confidence, lifecycle, clean answers, tangent point, Skip Coach, calibration, heatmap, at-risk, leaderboard, override queue, Detective learned
- [x] Guided demo checklist for judges (compact pill, 8 steps, auto-ticks; `markDemoStep` events from practice/teacher) (`src/components/tangent/demo-guide/`)
- [x] Session recap card after every 5 practice answers (`session-recap.tsx`)
- [x] Reset demo (Help menu → Reset demo, `POST /api/demo/reset` restores Riya from `data/riya-snapshot.json`, clears teacher corrections). seed-db regenerates the snapshot.
- [x] Fixed: header id hydration mismatch (guide moved to its own Suspense boundary); dead `text-amber-ink` class

──── CUT LINE B ────

### Phase 6 — P2
- [x] Mistake Fingerprint card (`src/components/tangent/fingerprint-card.tsx`): canvas-drawn 1080×1350 notebook page on /mistakes, downloadable PNG, fixed paper palette in either theme
- [x] Sprint mode (on /strategy)
- [x] Question bank 64 → 128 verified (61 + 3 new; 9 specs given up after repeated verifier rejection). 68 rejections logged (≈34% rejection rate). Neon reseeded with the full bank.
- [ ] Hinglish toggle (skipped: low value for the time left)

### Phase 7 — Submission (start by 10:30 PM)
- [x] README written (problem, solution, 7 requirements map, architecture, agents, algorithms, loops, eval, demo path, stack, setup)
- [x] Final deploy + live check (tangent-chi-seven.vercel.app, ~8:10 PM): all routes load (/, today, practice, diagnostic, map, reveal, mistakes, strategy, teacher, under-the-hood, onboarding, 404); no horizontal overflow at 375px on any. Live practice: verdict 260ms, Detective 3.6s (line 2, A1_ADD_SUCCESSIVE, 99%). Live lesson plan 12s. Neon reseeded afterwards.
- [x] Skip Coach: when no mastery cut-off helps, says so plainly instead of "above 0% mastery would have scored +0"

## Known bugs
- Instant grading is ~350–400ms (target <200ms): several sequential Neon HTTP round-trips.
- Testing pollutes Riya's demo state. Reseeded at ~7:45 PM with the 128-question bank (Riya: A1 0.18 / A4 0.18, A1_ADD_SUCCESSIVE fixing, 49 attempts, 4 due). Before recording: persona menu → Help → **Reset demo** (or `npx tsx scripts/seed-db.ts`).
- `/map` at 375px fits but is tiny (pan/zoom works).
- In a hidden/background tab, streamed sections (/mistakes) and the /reveal animation wait for the tab to become visible (React reveals on animation frames). Fine for real visitors; looks frozen only in hidden test panes.

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
- Gemini thinking level matters a lot: Flash at default thinking took >45s per question draft (timeouts); `thinking: "LOW"` → ~6s. Generator uses LOW (verifier re-solves everything). Verifier (Pro) keeps default thinking with a 90s timeout. Use LOW/MINIMAL for any latency-sensitive call (detective on typed text, coach).
- `grading.normalizeAnswer` strips option labels ("B. 48,000"): the verifier sometimes echoes them.
- seed-db: Riya's skill profile is hand-tuned and her random misattribution is 8% (vs 35% for synthetic students) so her story stays clean; her review cards are post-processed to 4 due (rest spread over the next week).
- Riya's seed skills tuned after the bank grew (A4 900, A1/A4 drawn more often) so the weak A1→A4 chain doesn't depend on which questions the simulation draws.
- Riya's seeded state: A1_ADD_SUCCESSIVE active ("fixing"); A4_ADD_DISCOUNTS deliberately absent so the demo detects it live.
- Gemini Flash 3.8 rejects thinking level MINIMAL (400). Use LOW for fast calls.
- `vercel.json` pins functions to `sin1` (Singapore) next to Neon; the default iad1 would add a trans-Pacific hop to every query.
- After the folder move, the copied `.next` cache and a stale dev server from the old folder caused false 404s, and the preview tool kept launching from the old folder, so the dev server is run with `npx next dev -p 3001` from this folder.
- `cacheComponents` is on in Next 16: use `await connection()` instead of `export const dynamic`.
- `db` in `@/lib/db` is a lazy Proxy so `next build` works without DATABASE_URL.

## Human tasks
1. [x] (done by Claude) Create a Neon project (or add Neon from Vercel's Storage tab); paste the pooled `DATABASE_URL` into `.env.local` (and Vercel env vars). Then Claude runs `npm run db:push`.
2. [x] (done by Claude) Create a Vercel Blob store; paste `BLOB_READ_WRITE_TOKEN` into `.env.local` and Vercel.
3. [x] Add `GEMINI_API_KEY` (+ model IDs) to `.env.local` and Vercel.
4. [ ] Hand-write 3–4 wrong solutions (successive discounts added; avg speed = mean of speeds; adding days in time & work; area ratio not squared), photograph, save as `public/samples/sample-1.jpg` …
5. [x] (done by Claude) Connect GitHub repo to Vercel.
6. [ ] Record 2–3 min demo video; LinkedIn posts at milestones.
