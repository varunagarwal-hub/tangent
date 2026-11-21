# Tangent — Master Build Plan (read fully before writing any code)

You are building **Tangent**, an adaptive CAT Quant exam-prep tutor, for the Product Space Agentic AI Hackathon (Problem Statement 2: "Adaptive exam-prep tutor with a learner model"). The submission deadline is **21 Nov 2026, 11:59 PM IST, today**. We submit by 11:30 PM. Speed and reliability beat ambition: always keep the app in a deployable, demo-able state.

**Name:** Tangent. **Tagline:** *Catches the exact moment your thinking goes off on a tangent.*

**One-liner:** An adaptive CAT Quant tutor that reads your rough work, finds the exact line where your thinking went off on a tangent, and rebuilds your prep around it.

**Brand idea:** Your reasoning is a curve. A mistake is the point where it veers off along a tangent. Tangent finds that point, circles it in red pen, and steers you back. Use this metaphor consistently in copy, the logo and the animations.

**Core idea:** Generic tutors check the final answer. Tangent checks the *reasoning*: typed working, a drawn scratchpad, or a photo of handwritten rough work.

---

## 0. Working rules (follow these the whole time)

1. On your first run, create:
   - `CLAUDE.md`: a short project summary, these working rules, the stack, the env vars, and "Read MASTER_PLAN.md and PROGRESS.md before doing anything."
   - `PROGRESS.md`: a checklist of every phase and task below, with sections **Done / In progress / Next / Known bugs / Human tasks**.
2. After finishing **every** task: update `PROGRESS.md`, then `git commit` with a clear message. Push after every phase. Another person's Claude Code may take over mid-build using only this repo, so the files must always reflect the true state.
3. Never commit `.env*` files. Keep `.env.example` up to date.
4. Work phase by phase in the order given. Don't start a P1 task while a P0 task is broken.
5. Keep the app building (`npm run build` passes) at the end of every phase.
6. Ask the human only when truly blocked (for example, missing keys). Otherwise choose sensibly and note the decision in `PROGRESS.md`.
7. The math is in code and the judgment is in AI: mastery, difficulty and scheduling are deterministic algorithms. LLMs handle reading, diagnosing, writing, explaining and planning language.

---

## 1. Rubric we are optimizing for

| Criterion | Weight | How Tangent wins it |
|---|---|---|
| Prototype quality & UX | 25% | Distinctive "graph paper & red pen" design, one-click demo personas, cinematic reveal moments, works on mobile |
| AI integration | 25% | 7 agents with a visible live trace, Gemini vision on handwriting, generator–verifier loop, evaluation score |
| Problem understanding | 20% | Reasoning-level diagnosis, CAT-specific details (negative marking, speed as mastery, coaching batches) |
| Innovation & creativity | 15% | Reads rough work, "right answer / wrong reasoning", Skip Coach, teachers train the detective |
| LinkedIn | 15% | Shareable visuals: red-pen circle, Mastery Map reveal, Mistake Fingerprint card |

**All 7 brief requirements are mandatory:** diagnostic test, concept graph for one syllabus, learner model updated after every answer, targeted question generation with difficulty calibration, misconception detection from reasoning, spaced repetition, teacher dashboard with class-wide gaps.

---

## 2. Tech stack

- **Next.js (latest stable, App Router, TypeScript, `src/` dir)**, deployed on **Vercel**
- **Tailwind CSS** + **shadcn/ui**; **Magic UI** components (number-ticker, animated-beam, bento-grid, border-beam, blur-fade), installed through the shadcn CLI as described in the magicui.design docs
- **GSAP** + `@gsap/react` (all plugins are free: use DrawSVG and SplitText), **Motion** (framer-motion) for micro-interactions, **Lenis** for smooth scrolling on the landing page only
- **rough-notation** for the hand-drawn red-pen circles, underlines and highlights; **roughjs** for hand-drawn chart accents where useful
- **@xyflow/react** for the concept graph; **Recharts** for charts; **KaTeX** (`react-katex` or `katex`) for ALL math rendering
- **perfect-freehand** for the scratchpad canvas (exported as PNG)
- **Neon Postgres** via `@neondatabase/serverless` (neon-http driver) + **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`). The database is accessed only from server code (no RLS, no auth). Demo personas are selected by a cookie.
- **Vercel Blob** (`@vercel/blob`) for rough-work image uploads
- **Gemini API** via `@google/genai`. Use JSON-schema structured output (`responseMimeType: "application/json"` + `responseSchema`), validate everything with **Zod**, retry once on parse failure. Check the Gemini docs for current model IDs and put them in env:
  - `GEMINI_MODEL_FAST`: latest Flash model (detective on typed text, coach, explanations)
  - `GEMINI_MODEL_SMART`: latest Pro model (verifier, vision/handwriting, lesson plans)
- `ts-fsrs` for spaced repetition
- All AI calls run in server route handlers or server actions. Set `export const maxDuration = 60` on AI routes. Never expose keys to the client.

**Env vars (`.env.example`):** `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `DATABASE_URL` (Neon pooled connection string), `BLOB_READ_WRITE_TOKEN`.

---

## 3. Design system: "Graph paper & red pen"

The whole app should feel like a beautifully designed CAT prep notebook that a mentor has marked up. Avoid generic AI-dashboard looks (no purple gradients, no glassmorphism).

- **Paper background:** `#F7F5EF` with a faint graph-paper grid (CSS background, 24px squares, lines about 6% opacity ink).
- **Ink:** `#1B2A4A` (primary text), `#5B6478` (secondary)
- **Red pen:** `#D93A2B` (mistakes, misconceptions, annotations)
- **Highlighter:** `#FFE45C` at about 60% (key insights, "due today")
- **Mastery scale:** red-pen `#D93A2B` (<0.4) → amber `#E8A33D` (0.4–0.7) → green `#2F8F5B` (>0.7); unknown concepts are pencil-gray `#B8B4A8`, dashed
- **Dark mode = chalkboard:** `#1E2B26` background, chalk-white text, chalk-red and chalk-yellow accents. Define all colors as CSS variables.
- **Fonts (next/font):** Instrument Serif (headlines), Geist (UI; `geist` package), Caveat (handwritten margin notes and annotations), JetBrains Mono (numbers, timers, scores)
- **Signature interactions:**
  1. **Red-pen moment:** after a wrong submission, rough-notation draws a red circle around the exact wrong line of the student's work, and a Caveat-font margin note slides in explaining the mistake. This is the hero moment, so polish it.
  2. **Mastery Map reveal:** after the diagnostic, a full-screen GSAP sequence: edges draw in (DrawSVG-style stroke animation), nodes pop in staggered and fill to their mastery color, and the headline animates with SplitText.
  3. **Fading nodes:** concept nodes lose opacity as they become due for review (forgetting curve made visible).
  4. **Agent trace:** an "Under the hood" side panel where each agent step appears in sequence with an animated beam connecting the steps.
- **Logo:** a wordmark "tangent" in Instrument Serif, with a small hand-drawn curve whose tangent line breaks off it, the touch point marked with a red-pen dot. Build it as an inline SVG component; use the curve + red dot alone as the favicon.
- Use subtle paper-like shadows, 12px radius cards, generous whitespace, and small hand-drawn underline accents on section headings.
- **Copy voice:** use the metaphor lightly, e.g. "Off on a tangent" as the label for a detected mistake, "Back on the curve" when a misconception is resolved, "Tangent point" for the exact erroneous line.
- Respect `prefers-reduced-motion` (turn heavy animations into simple fades). Fully responsive: test at a 375px width.

---

## 4. Syllabus: CAT Quant concept graph (27 nodes)

Store in `data/concepts.json`. Each node: `id, name, area, prerequisites[], target_time_sec, weight` (weight = relative importance from recent CAT papers, 1–3; arithmetic and algebra mostly 3).

- **Arithmetic:** A1 Percentages · A2 Ratio & Proportion · A3 Averages · A4 Profit, Loss & Discount (←A1) · A5 Simple & Compound Interest (←A1) · A6 Mixtures & Alligation (←A2, A3) · A7 Time & Work (←A2) · A8 Time, Speed & Distance (←A2)
- **Number system:** N1 Number Properties & Divisibility · N2 HCF & LCM (←N1) · N3 Remainders (←N1)
- **Algebra:** L1 Indices & Surds · L2 Logarithms (←L1) · L3 Linear Equations · L4 Quadratic Equations (←L3) · L5 Inequalities & Modulus (←L3) · L6 Progressions (←L3) · L7 Functions & Graphs (←L3)
- **Geometry:** G1 Lines & Angles · G2 Triangles (←G1) · G3 Circles (←G2) · G4 Polygons & Quadrilaterals (←G2) · G5 Mensuration (←G2, G4) · G6 Coordinate Geometry (←L3, G2)
- **Modern math:** M1 Sets & Venn Diagrams · M2 Permutations & Combinations · M3 Probability (←M2)

**Depth focus:** the arithmetic chain (A1→A4/A5, A2→A6/A7/A8) gets the most questions and misconceptions. The demo story lives there.

---

## 5. Misconception library

`data/misconceptions.json`, about 3 per concept (about 75 total; at least 4 per arithmetic concept). Each: `id, concept_id, name, description, wrong_reasoning_example, telltale_signs[], contrast_question_idea`.

Seed examples (write the rest in the same quality):
- A1: adds successive percentage changes (+20% then −20% = 0%); assumes "A is 25% more than B" means "B is 25% less than A"
- A4: computes profit % on selling price instead of cost price; adds successive discounts
- A5: uses simple interest where interest compounds; for half-yearly compounding, doesn't halve the rate and double the periods
- A3/A6: averages the averages without weighting by group sizes; applies alligation to quantities instead of concentrations
- A7: adds the days instead of adding the work rates
- A8: average speed = arithmetic mean of the speeds; sums speeds for same-direction relative speed; ignores train length when crossing a platform
- L2: log(a+b) = log a + log b
- L4: divides both sides by the variable and loses a root
- L5: multiplies an inequality by a negative number without flipping the sign
- L6: uses n instead of (n−1) in the nth-term formula
- G2: assumes the area ratio of similar triangles equals the side ratio (forgets to square)
- G3: confuses inscribed angle with central angle
- M2: uses permutations where order doesn't matter, or overcounts identical items
- M3: adds probabilities of events that aren't mutually exclusive; treats dependent events as independent
- N3: mishandles negative remainders

---

## 6. Data model (Drizzle schema → `src/lib/db/schema.ts`; create tables with `npm run db:push`)

Typed client: `import { db } from "@/lib/db"` (server-only). Scripts use `getDb()` from `src/lib/db/client.ts`. Column names below are the SQL names; Drizzle fields are camelCase.

- `concepts` (id text pk, name, area, prerequisites text[], target_time_sec int, weight int)
- `misconceptions` (id text pk, concept_id, name, description, wrong_reasoning_example, telltale_signs text[], contrast_question_idea)
- `questions` (id uuid pk, concept_id, type 'MCQ'|'TITA', stem text (supports LaTeX), options jsonb null, answer text, solution text, difficulty_elo float default 1200, attempts_count int, source 'bank'|'generated', verified bool, targets_misconception_id text null, distractor_misconceptions jsonb, status 'active'|'retired', created_at)
- `students` (id uuid pk, name, role 'student'|'teacher', class_id, target_percentile int, exam_date date, daily_minutes int, persona jsonb, is_synthetic bool)
- `classes` (id, name, teacher_id)
- `attempts` (id, student_id, question_id, concept_id, answer, is_correct, time_sec, confidence 1–3, work_text text, work_image_url text, transcription text, reasoning_verdict 'sound'|'flawed'|'unknown', misconception_id text null, error_line text, diagnosis jsonb, agent_trace jsonb, mode 'diagnostic'|'practice'|'review'|'contrast', created_at)
- `mastery` (student_id, concept_id, p_mastery float, elo float default 1200, avg_time_ratio float, calibration float, attempts int, last_seen, pk(student_id, concept_id))
- `misconception_events` (id, student_id, misconception_id, status 'detected'|'fixing'|'resolved', evidence_count int, clean_count int, updated_at)
- `review_cards` (student_id, item_type 'concept'|'misconception', item_id, fsrs_state jsonb, due_at)
- `feedback` (id, attempt_id, by_role, kind 'disagree_diagnosis'|'bad_question'|'teacher_relabel', note, corrected_misconception_id, created_at)
- `fewshot_examples` (id, misconception_id, work_text, source 'teacher'|'seed', created_at): teacher corrections become detective examples
- `assignments` (id, class_id, concept_id, question_ids uuid[], created_at, baseline_mastery float)
- `agent_runs` (id, agent, student_id, input_summary, output jsonb, latency_ms, status, created_at)

Uploaded images go to **Vercel Blob** via `uploadRoughWork(file)` in `src/lib/storage.ts` (public URL under `rough-work/`), max 4MB, compressed client-side first (`src/lib/compress-image.ts`). If `BLOB_READ_WRITE_TOKEN` is missing, don't crash: send the image straight to Gemini, save only the transcription, and set `work_image_url` to null.

---

## 7. Learner model (deterministic, in `src/lib/learner/`)

**BKT per concept:** prior p(L0) = 0.3 (or from prerequisite propagation), p(T) = 0.15, p(S) = 0.1, p(G) = 0.25 for MCQ and 0.05 for TITA. Standard posterior update, then apply learning.

**Evidence adjustments:**
- Correct but `reasoning_verdict = 'flawed'` → treat as incorrect evidence with weight 0.5 (interpolate between the correct and incorrect posteriors).
- Correct but time > 1.5 × target_time → interpolate 70% toward the correct update (speed is part of mastery in CAT).
- Store `avg_time_ratio` as an exponential moving average.

**Prerequisite propagation:** when a concept has no attempts yet, its prior = 0.2 + 0.6 × mean(prerequisite mastery). When a prerequisite's mastery drops below 0.4, cap the dependent concepts' "ready" flag so the planner drills the prerequisite first.

**Elo (difficulty calibration):** P(correct) = 1 / (1 + 10^((q_elo − s_elo)/400)). Student K = 32; question K = 24 if attempts < 10, else 12. Update both after every attempt, so questions are calibrated by all students. **Target difficulty:** choose questions with predicted P(correct) between 0.6 and 0.7 (q_elo ≈ s_elo − 108).

**Confidence calibration:** per concept, the gap between average confidence (mapped 1→0.33, 2→0.66, 3→1) and accuracy. A "confidently wrong" answer raises the misconception prior and is shown as overconfidence.

**FSRS (ts-fsrs):** rating = Again (wrong), Hard (correct but slow, flawed, or low confidence), Good (correct), Easy (correct, fast, high confidence). One card per concept, plus one per active misconception.

**Write unit tests** (vitest) for BKT, Elo and the rating mapping. They're quick and give confidence.

---

## 8. The agents (`src/lib/agents/`; each logs to `agent_runs` and returns a trace step)

Each agent is a typed function with a Zod input/output schema and a short, sharp system prompt in `src/lib/agents/prompts/`. Every step returns `{agent, summary (one human-readable line), ms, status}` for the trace panel.

1. **Diagnostician:** adaptive diagnostic, 12 questions. Start with 1 question each from high-weight root concepts; after each answer pick the untested or most uncertain concept (p closest to 0.5, weighted by concept weight), stepping down to a prerequisite after a miss. Deterministic; Gemini writes only the final summary paragraph.
2. **Detective** (the hero): input = question, correct solution, student answer, work_text and/or work image, candidate misconceptions for the concept, and up to 3 few-shot examples (teacher-sourced first). Steps:
   - If an image is given: Gemini vision transcribes it into numbered lines → show the student **"Here's what I read"**, editable, then confirm. (Skip confirmation in quick mode.)
   - Diagnose → `{reasoning_verdict: sound|flawed|unknown, misconception_id | "novel", novel_description?, error_line_number, error_line_text, explanation_for_student (≤2 sentences, mentor tone), confidence 0–1}`.
   - Runs on wrong answers AND on correct answers that include work (to catch right-answer/wrong-reasoning). If confidence < 0.5, say "I'm not sure why. Can you tell me your approach?" instead of guessing.
3. **Planner:** a deterministic scorer over candidate actions: `contrast_question` (active misconception), `prerequisite_drill` (prerequisite mastery < 0.4), `review` (FSRS due), `practice` (largest weight × (1 − mastery) gap), `stretch` (mastery > 0.8). Picks the top one; Gemini Flash writes a one-sentence "Why this question?" Also builds the daily plan (Today screen) from mastery, days to the exam and daily minutes.
4. **Generator:** writes a CAT-style question for (concept, target_elo, optional target misconception). Output: stem (LaTeX allowed), type, options (MCQ: 4 options, distractors built from real misconceptions and tagged with them), answer, step-by-step solution, estimated difficulty. Contrast questions must be built so the target misconception gives a clearly wrong, tagged distractor.
5. **Verifier:** solves the question independently with GEMINI_MODEL_SMART without seeing the answer key, then compares. On mismatch or ambiguity → reject with a reason → the generator retries (max 2) using that reason → otherwise fall back to a bank question. Log every rejection; show "Verifier rejected 1 draft: answer mismatch" in the trace.
6. **Coach:** feedback text, the Skip Coach insight, weekly summary, misconception-resolved celebrations. Warm, concise, Indian-English mentor voice, never patronising.
7. **Teacher analyst:** from class aggregates, produces the "Monday lesson plan": top 3 gaps, the shared misconception behind each, a worked example to teach, student groupings, and a suggested 10-question targeted set (from the bank).

**Latency strategy (important):**
- On submit: grade instantly and show correct/incorrect in under 200ms.
- Stream the detective result; animate trace steps as they complete so the wait feels purposeful (show a pen-writing loading state).
- The next question comes from a **pre-verified pool**: keep ≥3 verified questions per (concept, difficulty band) per student context; refill with generator+verifier in the background (Next.js `after()` or a fire-and-forget route). Never block the UI on generation.
- Cache identical calls. Timeouts of 25s with graceful fallbacks to bank content.

---

## 9. Feedback loops (each one must be visible somewhere in the UI)

1. **Answer loop:** answer → mastery/Elo update → planner picks the next move.
2. **Misconception lifecycle:** detected → fixing (contrast question served) → resolved after 2 clean correct answers with sound reasoning; it reopens on recurrence. Shown as a "Mistake Journal" with status chips and a confetti-style red-pen tick when resolved.
3. **Generator ↔ verifier loop**, with rejection reasons in the trace.
4. **Question calibration loop:** question Elo updates from all students; a question is auto-retired if it's flagged twice or its rating drifts above 2000 or below 600.
5. **Forgetting loop:** FSRS due dates → node fade on the map → review queue.
6. **Confidence loop:** calibration chart; "confidently wrong" feeds misconception priors and the Skip Coach.
7. **Student disagreement:** "That's not why I got it wrong" → student explains → detective re-runs with that context → result logged to `feedback`.
8. **Teacher correction → few-shot learning:** a teacher relabels a diagnosis in the override queue → saved to `fewshot_examples` → the detective uses it for future cases on that misconception. Show a badge: "Detective learned from 3 teacher corrections."
9. **Teacher → class impact loop:** an assignment stores baseline mastery; the dashboard shows the before/after lift for that concept.
10. **Plan loop:** the daily plan regenerates after each session.

---

## 10. Screens & routes

- `/` **Landing:** hero headline (SplitText) "Your answer was wrong. Let's find where you went off on a tangent." Hero animation (GSAP, DrawSVG): a smooth ink curve draws across the graph paper, a straight line veers off it, the red pen circles the touch point, and the scene morphs into a handwritten solution with the wrong line circled and a Caveat margin note. Then a looping demo of the red-pen moment on real rough work. Bento grid of features, a mini animated concept graph, "How it works" in three steps. Two big buttons: **Try as Riya (student)** and **Try as Prof. Mehta (teacher)**. Footer link to `/under-the-hood`.
- `/onboarding`: target percentile, exam date, minutes/day (three quick steps, skipped for demo personas).
- `/diagnostic`: question card (KaTeX), timer (mono), confidence selector (Guessing / Fairly sure / Certain), **work input tabs: Scratchpad (draw) | Type | Upload photo | Use sample rough work** (sample images are in `public/samples/`), a mini concept map filling in live on the side, progress dots.
- `/reveal`: the Mastery Map reveal sequence → top 3 misconceptions → "Your plan" CTA.
- `/today`: next best action card with "Why this?", due reviews count, streak, days to CAT, mastery by area (small bars), Mistake Journal preview.
- `/practice`: the core loop. Question → submit → instant verdict → red-pen annotation on the work → margin explanation → "That's not why" button → next-step card (contrast question / prerequisite drill / review). Collapsible **Under the hood** trace panel on the right (a bottom sheet on mobile).
- `/map`: full interactive concept graph (React Flow, custom paper-styled nodes with a mastery ring, fade by due-ness); clicking a node opens a drawer with a mastery-over-time line chart, attempts, misconceptions and the forgetting curve.
- `/mistakes`: Mistake Journal (lifecycle statuses) + **Mistake Fingerprint** shareable card (P2: downloadable PNG of your top misconceptions and progress, styled like a marked notebook page, with the Tangent logo watermark).
- `/strategy`: **Skip Coach:** simulated CAT scoring (+3/−1 MCQ, TITA no negative) on the student's history: "Attempting only above 0.55 mastery would have scored +X." Confidence-vs-accuracy calibration chart per area. Sprint mode toggle (P2): rank concepts by weight × (1 − mastery) / time-to-improve.
- `/teacher`: class selector; KPI tickers (students, avg mastery, active misconceptions, at-risk students); **heatmap** concepts × students (sortable, red→green); **misconception leaderboard** (count, % of class, trend); **Monday lesson plan** (teacher analyst, generate button, rendered as a marked-up notebook page); student drill-down drawer; **override queue** (recent low-confidence diagnoses to confirm or relabel); assignments with impact.
- `/under-the-hood`: for judges. Architecture diagram (the agent loop), each agent's role, the algorithms explained in plain English (BKT, Elo, FSRS), a live feed of recent `agent_runs`, the **detective evaluation score**, and the verifier rejection rate.
- A persona switcher in the header (Riya / Prof. Mehta / New student) and a light/chalkboard theme toggle.

---

## 11. Seed data & demo (scripts in `scripts/`, run with `tsx`)

- `seed-content.ts`: writes `concepts.json` and `misconceptions.json`, and generates a **bank of about 150 questions** (heavier on arithmetic), each passed through the verifier; only verified ones are saved to `data/questions.json`. Commit the JSON so the demo never depends on live generation.
- `seed-db.ts`: loads the JSON into Neon (via Drizzle); creates class "CAT 2027 Batch A", teacher Prof. Mehta, and **30 synthetic students** with personas (e.g. strong in algebra/weak in arithmetic, careless/fast, slow/accurate, overconfident) simulated through the real learner model over 40–80 attempts each, with misconception events drawn from their persona. This gives realistic heatmap patterns: make "averaging averages" and "successive percentages" class-wide gaps.
- **Riya (demo student):** pre-loaded history showing weakness in A1→A4 with the active misconception "adds successive percentage changes", a 6-day streak and a few due reviews, so every screen looks alive instantly.
- `eval-detective.ts`: runs the detective on `data/evals/detective.json` (20 labeled typed wrong solutions covering 10+ misconceptions) and writes accuracy plus a confusion summary to `data/evals/results.json`, shown on `/under-the-hood`.
- **Scripted demo path** (also in the README): Riya → practice → sample rough work for a successive-discount question → red-pen circle → contrast question → correct → mastery ticks up on the map → switch to Prof. Mehta → heatmap → lesson plan → relabel a diagnosis → "Detective learned" badge.

---

## 12. Build phases (in order; deploy at the end of Phase 3; cut lines marked)

**Phase 0 — Setup (≈30 min):** scaffold Next.js, Tailwind, shadcn, fonts, design tokens (paper grid, colors, dark chalkboard), CLAUDE.md, PROGRESS.md, .env.example, Drizzle schema (Neon) + Vercel Blob storage helper, Gemini client wrapper with structured output + Zod + retry + `agent_runs` logging. Push to GitHub.

**Phase 1 — Content & learner model (≈1.5 h):** concepts and misconceptions JSON, learner model (BKT/Elo/calibration/FSRS mapping) with tests, seed-content script (start with 60 questions to save time; expand later), seed-db with Riya, Prof. Mehta and 30 synthetic students.

**Phase 2 — Core student loop (≈2 h):** diagnostic, practice page, work input (type, scratchpad, upload, sample), detective with the transcription-confirm step, red-pen annotation, planner + "Why this?", pre-verified pool with background generator+verifier, agent trace panel.

**Phase 3 — Map, reveal, today, review (≈1.5 h):** React Flow mastery map with fade, reveal animation, Today screen, review queue, Mistake Journal with lifecycle. **→ DEPLOY TO VERCEL NOW and test the full Riya path on the live URL.**

**Phase 4 — Teacher dashboard (≈1.5 h):** heatmap, leaderboard, lesson plan, drill-down, override queue → few-shot loop, assignments + impact.

──── **CUT LINE A:** everything above is P0 and must ship. ────

**Phase 5 — P1 polish (≈1 h):** landing page animations, Skip Coach + calibration, "That's not why" loop, under-the-hood page with the eval score, mobile pass, reduced-motion, empty/loading/error states (pen-writing loader).

──── **CUT LINE B** ────

**Phase 6 — P2 extras (only if time):** Mistake Fingerprint share card, Sprint mode, expand the question bank to 150, Hinglish toggle for coach messages.

**Phase 7 — Submission assets (≈30 min, start no later than 10:30 PM):** README (problem, solution, architecture, agents, algorithms, feedback loops, evaluation results, scripted demo path, tech stack, setup), final deploy, and a check that every route works on the live URL and on mobile.

---

## 13. Quality bar & guardrails

- Never reveal the answer or solution before the student submits. The coach must not just dump solutions; it explains the *mistake* first, then offers the full solution behind a "Show solution" toggle.
- All AI output is validated; on failure show a graceful fallback, never a crash or raw JSON.
- Rate-limit AI routes lightly per persona; limit image size; sanitize uploads.
- No fake precision: never predict a CAT percentile. Show mastery and readiness by area instead.
- Accessibility: keyboard navigable, visible focus, alt text, color + icon/text for mastery (never color alone).
- No console errors, no layout shift on the key screens, Lighthouse-friendly.

---

## 14. Human tasks (list these in PROGRESS.md and remind the human)

1. Create a Neon project (or add Neon from Vercel's Storage tab) and paste the pooled `DATABASE_URL` into `.env.local` and Vercel env vars. Then `npm run db:push` creates the tables.
2. Create a Vercel Blob store and paste `BLOB_READ_WRITE_TOKEN` into `.env.local` and Vercel (optional locally: without it, images go straight to Gemini and aren't stored).
3. Add `GEMINI_API_KEY` (and model IDs) to `.env.local` and Vercel.
4. **Write 3–4 wrong solutions by hand on paper** (one each for: successive discounts added, average speed as the mean of speeds, adding days in time & work, area ratio not squared), photograph them in good light, and save them to `public/samples/` as `sample-1.jpg`, etc.
5. Connect the GitHub repo to Vercel.
6. Record a 2–3 minute demo video following the scripted demo path; post LinkedIn updates at each milestone.

---

## 15. Start now

Begin with Phase 0. First create CLAUDE.md and PROGRESS.md, then build. Work through the phases in order, committing and updating PROGRESS.md after every task. When a phase is done, give a short summary of what works and what the human needs to do next.
