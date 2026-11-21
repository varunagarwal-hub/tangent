# Tangent — Progress

Last updated: Phase 0 in progress. Keep this file true at every commit.

## Done
- [x] P0.1 Scaffold Next.js 16 (App Router, TS, src/, Tailwind v4) + git init
- [x] P0.2 shadcn/ui init + base components; Magic UI (number-ticker, animated-beam, bento-grid, border-beam, blur-fade)
- [x] P0.3 Install stack deps (gsap, motion, lenis, rough-notation, roughjs, xyflow, recharts, katex, perfect-freehand, supabase, genai, zod, ts-fsrs, vitest, tsx)
- [x] P0.4 CLAUDE.md, PROGRESS.md, .env.example

## In progress
- [x] P0.5 Fonts + design tokens (paper grid, ink, red pen, highlighter, mastery scale, chalkboard dark mode) + Logo SVG + favicon
- [x] P0.6 `supabase/schema.sql`
- [ ] P0.7 Gemini wrapper (structured output + Zod + retry + timeout + agent_runs logging)
- [ ] P0.8 Build passes, push to GitHub

## Next
### Phase 1 — Content & learner model
- [ ] data/concepts.json (27 nodes)
- [ ] data/misconceptions.json (~75; ≥4 per arithmetic concept)
- [ ] Learner model: BKT, Elo, calibration, FSRS rating map + vitest tests
- [ ] scripts/seed-content.ts → data/questions.json (60 verified to start)
- [ ] scripts/seed-db.ts (Riya, Prof. Mehta, CAT 2027 Batch A, 30 synthetic students)

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

## Human tasks
1. [ ] Create Supabase project; run `supabase/schema.sql` in SQL editor; create public storage bucket `rough-work`; put `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel.
2. [ ] Add `GEMINI_API_KEY` (+ model IDs) to `.env.local` and Vercel.
3. [ ] Hand-write 3–4 wrong solutions (successive discounts added; avg speed = mean of speeds; adding days in time & work; area ratio not squared), photograph, save as `public/samples/sample-1.jpg` …
4. [ ] Connect GitHub repo to Vercel.
5. [ ] Record 2–3 min demo video; LinkedIn posts at milestones.
