# Tangent

**Catches the exact moment your thinking goes off on a tangent.**

Tangent is an adaptive CAT Quant tutor. It reads your rough work (typed, drawn or photographed), finds the exact line where your reasoning veered off, names the misconception behind it, and rebuilds your prep around that point.

**Live demo:** https://tangent-chi-seven.vercel.app. No sign-up: pick **Try as Riya (student)** or **Try as Prof. Mehta (teacher)**.

Built for the Product Space Agentic AI Hackathon, Problem Statement 2: *Adaptive exam-prep tutor with a learner model*.

---

## The problem

About 3 lakh students take CAT every year, and Quant is the section that sinks most of them. The tools they practise on all do the same thing: check the final answer, show the solution, and move on.

That misses the real problem. A wrong answer tells you very little; **the line where it went wrong tells you everything.** A student who writes "20% off then 10% off = 30% off" doesn't need the solution to that question. They need someone to circle line 2, tell them successive discounts multiply, and then check over the next few days that the habit is gone. A good mentor does this with a red pen. Coaching batches of 60 can't.

Some CAT-specific details make this worse:
- **Negative marking (+3 / −1 on MCQs, no penalty on TITA)** means knowing what to skip is half the game.
- **Speed is part of mastery.** A correct answer in 4 minutes on a 2-minute question isn't mastery.
- **Right answer, wrong reasoning** happens often in MCQs, and answer-checking tools reward it.
- **Teachers can't see class-wide misconceptions** until a mock test exposes them weeks later.

## The solution

Tangent checks the **reasoning**, not just the answer.

1. **Diagnostic (12 adaptive questions):** starts at high-weight root concepts and steps down to prerequisites after a miss. Ends with a cinematic **Mastery Map reveal**.
2. **Practice with rough work:** type it, draw it on the scratchpad, or upload a photo of your notebook. On submit you get an instant verdict, then the **Detective** reads your work, circles the exact wrong line in red pen, and writes a two-sentence margin note in a mentor's voice.
3. **Right answer, wrong reasoning:** the Detective also runs on correct answers that come with work, and gives half credit when the reasoning is flawed.
4. **Misconception lifecycle:** every detected misconception is tracked from *Off on a tangent* → *Fixing* (a contrast question built so the misconception gives a tagged wrong option) → *Back on the curve* (after two clean answers with sound reasoning). It reopens if the mistake comes back.
5. **Planner:** every next question is chosen deliberately (contrast question, prerequisite drill, spaced review, practice, or stretch), with a one-line "Why this question?"
6. **Teacher dashboard:** a concept × student heatmap, a class misconception leaderboard, an AI-written Monday lesson plan, and an override queue. **When a teacher corrects a diagnosis, it becomes a few-shot example the Detective uses from then on: teachers train the detective.**

## All 7 brief requirements

| Requirement | Where it lives |
|---|---|
| Diagnostic test | `/diagnostic`: adaptive, 12 questions, Diagnostician agent (`src/lib/agents/diagnostician.ts`) |
| Concept graph for one syllabus | 27-node CAT Quant graph with prerequisites (`data/concepts.json`), interactive at `/map` |
| Learner model updated after every answer | BKT + Elo + calibration + FSRS in `src/lib/learner/`, applied in `recordAttempt` on every submit |
| Targeted question generation with difficulty calibration | Generator → Verifier loop at a target Elo (P(correct) ≈ 0.6–0.7); question Elo is recalibrated from every student's attempts |
| Misconception detection from reasoning | Detective agent: vision transcription + diagnosis against an 82-entry misconception library, with the exact error line |
| Spaced repetition | ts-fsrs cards per concept and per active misconception; due cards fade on the map and feed the review queue |
| Teacher dashboard with class-wide gaps | `/teacher`: heatmap, misconception leaderboard, lesson plan, override queue, assignment impact |

---

## Architecture

```
 Student work (typed / drawn / photo)
          │
          ▼
   ┌──────────────┐  vision + diagnosis   ┌──────────────────────────┐
   │  Detective   │──────────────────────▶│      Learner model       │  deterministic code:
   │ (Gemini)     │  misconception, line  │  BKT · Elo · calibration │  mastery, difficulty,
   └──────▲───────┘                       │  FSRS · lifecycle        │  scheduling
          │ few-shot examples             └────────────┬─────────────┘
          │                                            ▼
 ┌────────┴─────────┐                         ┌──────────────┐   "why this?"
 │ Teacher override │                         │   Planner    │──────────────▶ Next question
 │ queue → relabel  │                         │ scorer+Flash │                 (< 200ms, from pool)
 └────────▲─────────┘                         └──────┬───────┘
          │                                          │ refill in background (after())
 ┌────────┴─────────┐                         ┌──────▼───────┐  reject + reason ┌────────────┐
 │ Teacher analyst  │  class aggregates       │  Generator   │◀─────────────────│  Verifier  │
 │ (lesson plan)    │                         │   (Flash)    │─────────────────▶│ (Pro, blind│
 └──────────────────┘                         └──────────────┘   draft question │   solve)   │
                                                                                 └─────┬──────┘
                                                                accepted → pre-verified pool
```

**The rule we held to: the maths is in code and the judgment is in AI.** Mastery, difficulty and scheduling are deterministic algorithms you can unit-test. Gemini only does what needs judgment: reading handwriting, diagnosing reasoning, writing questions, and explaining.

### The seven agents (`src/lib/agents/`)

Each agent has a Zod input/output schema, a short system prompt in `src/lib/agents/prompts/`, logs every run to `agent_runs`, and returns a trace step shown live in the **Under the hood** panel.

| Agent | Model | What it does |
|---|---|---|
| **Detective** (the hero) | Pro (vision) + Flash | Transcribes photographed work into numbered lines ("Here's what I read", editable), then diagnoses: verdict, misconception id (or "novel"), error line, a two-sentence explanation, and a confidence score. Below 0.5 confidence it asks the student for their approach instead of guessing. |
| **Diagnostician** | code + Flash | Picks each diagnostic question deterministically (highest weight × uncertainty, step down to a prerequisite after a miss); Flash writes the summary. |
| **Planner** | code + Flash | Scores contrast / prerequisite drill / review / practice / stretch and picks the best move; Flash writes "Why this question?". Also builds the daily plan. |
| **Generator** | Flash | Writes a CAT-style question at a target Elo, with distractors built from real misconceptions and tagged with them. |
| **Verifier** | Pro | Solves the question independently **without the answer key**. A mismatch or ambiguity rejects it with a reason; the generator retries up to twice, otherwise a bank question is used. |
| **Coach** | Flash | Margin notes, the Skip Coach insight, and "Back on the curve" celebrations, in a warm Indian-English mentor voice. |
| **Teacher analyst** | code + Pro | Top 3 class gaps, student groupings and a 10-question set (deterministic); Pro writes the lesson: why the misconception happens, a worked wrong-vs-right example, and a teaching move. |

### Algorithms (`src/lib/learner/`, unit-tested with vitest)

- **Bayesian Knowledge Tracing per concept:** prior 0.3 (or propagated from prerequisites: 0.2 + 0.6 × mean prerequisite mastery), learn 0.15, slip 0.1, guess 0.25 for MCQ / 0.05 for TITA. A correct answer with flawed reasoning counts as half-incorrect evidence. A correct but slow answer (> 1.5× target time) moves only 70% of the way, because speed is part of mastery in CAT.
- **Elo difficulty calibration:** students and questions are both rated. We target questions with a predicted P(correct) of 0.6–0.7. Question ratings update from every student's attempts, and a question is auto-retired if flagged twice or if its rating drifts outside 600–2000.
- **Confidence calibration:** students mark each answer Guessing / Fairly sure / Certain. The gap between confidence and accuracy is tracked per concept, and "confidently wrong" answers raise the misconception prior and feed the Skip Coach.
- **FSRS (ts-fsrs):** one card per concept plus one per active misconception. Wrong = Again; correct but slow, flawed or unsure = Hard; correct = Good; correct, fast and certain = Easy. Retrievability drives the node fade on the Mastery Map.

### Feedback loops (each visible in the UI)

1. **Answer loop:** answer → mastery and Elo update → planner picks the next move.
2. **Misconception lifecycle:** detected → fixing (contrast question) → resolved after 2 clean answers; reopens on recurrence (`/mistakes`).
3. **Generator ↔ verifier:** rejection reasons shown in the trace ("Verifier rejected 1 draft: answer mismatch").
4. **Question calibration:** question Elo updates from all students; auto-retire.
5. **Forgetting:** FSRS due dates → node fade on the map → review queue.
6. **Confidence:** calibration chart; confidently-wrong answers feed misconception priors and the Skip Coach.
7. **Student disagreement:** "That's not why I got it wrong" → the student explains → the Detective re-runs with that context → logged to `feedback`.
8. **Teacher correction → few-shot learning:** a relabel in the override queue becomes a Detective example ("Detective learned from N teacher corrections").
9. **Teacher → class impact:** assignments store baseline mastery; the dashboard shows the lift.
10. **Plan loop:** the daily plan regenerates after each session.

### Latency strategy

- Grading is instant and deterministic (no AI on the critical path).
- The Detective streams its trace steps as NDJSON, so the wait shows what it's doing.
- The next question comes from a **pre-verified pool** (≥ 3 per concept × difficulty band), refilled in the background with `after()`. The UI never waits on generation.
- 25s timeouts with graceful fallbacks to bank content; identical calls are cached; light per-persona rate limits on AI routes.

---

## Evaluation

| Measure | Result |
|---|---|
| Detective: misconception named correctly | **20 / 20** labelled cases (15 misconceptions, incl. 2 right-answer/wrong-reasoning) |
| Detective: exact error line found | **20 / 20** |
| Detective: average latency | 3.6s (Gemini Flash) |
| Verifier rejection rate while building the bank | **~34%** of generated drafts rejected (68 rejections: wrong answer keys, no correct option, typos, impossible numbers) |
| Question bank | **128 verified questions** across all 27 concepts, heaviest on arithmetic |

Honest caveat: the eval set is typed solutions; real handwriting is harder. Run it yourself with `npx tsx scripts/eval-detective.ts` (results land in `data/evals/results.json` and on `/under-the-hood`).

---

## Scripted demo path (about 3 minutes)

1. **Landing** → **Try as Riya (student)**. Riya is weak on Percentages → Profit & Loss and has a live misconception: *adds successive percentage changes*.
2. **Today** shows her next best move with "Why this?", 4 due reviews, a 6-day streak, and mastery by area.
3. **Practice** → a successive-discount question → choose the trap option → **Use sample rough work** → watch the trace → the red pen circles line 2: *"Off on a tangent: successive discounts multiply."*
4. Click **That's not why** to see the disagreement loop, or go **Next** → a contrast question built around the same misconception → answer correctly → mastery ticks up.
5. **Map** → the concept graph with mastery rings, faded nodes that are due, and red dots on active misconceptions. Click a node for its mastery and forgetting curves.
6. **Mistakes** → the Mistake Journal with lifecycle chips → download the **Mistake Fingerprint** card.
7. **Strategy** → the Skip Coach replays her history under CAT marking.
8. Switch persona to **Prof. Mehta** → **Teacher**: heatmap (successive percentages and averaging averages are class-wide gaps), misconception leaderboard → **Generate lesson plan** → **Assign this set**.
9. Override queue → relabel a diagnosis → the **"Detective learned from teacher corrections"** badge increments.
10. **Under the hood** → the agent loop, the live agent feed, the eval score and the verifier rejection rate.

---

## Tech stack

- **Next.js 16** (App Router, TypeScript, Cache Components) on **Vercel** (functions pinned to `sin1`, next to the database)
- **Tailwind CSS v4**, **shadcn/ui**, **Magic UI**; **GSAP** (DrawSVG, SplitText, ScrollTrigger), **Motion**, **Lenis** (landing only), **rough-notation** for the red pen
- **@xyflow/react** (concept graph), **Recharts**, **KaTeX** for all maths, **perfect-freehand** (scratchpad)
- **Neon Postgres** + **Drizzle ORM** (neon-http), **Vercel Blob** for rough-work photos
- **Gemini** via `@google/genai`: `gemini-3.8-flash` (fast) and `gemini-3.1-pro-preview` (smart), JSON-schema structured output validated with **Zod**, one retry on parse failure
- **ts-fsrs**, **vitest**, **tsx** scripts

Design: "graph paper & red pen". The app looks like a CAT notebook a mentor has marked up, with a chalkboard dark mode. It respects `prefers-reduced-motion` and works down to 375px.

---

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in GEMINI_API_KEY, DATABASE_URL (Neon pooled), optional BLOB_READ_WRITE_TOKEN
npm run db:push                # create the 13 tables
npx tsx scripts/seed-db.ts     # load content + Riya, Prof. Mehta and 30 simulated students
npm run dev
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests for BKT, Elo, FSRS rating mapping and answer grading |
| `npx tsx scripts/seed-content.ts` | Generate + verify the question bank into `data/questions.json` (resumable) |
| `npx tsx scripts/seed-db.ts` | Wipe and reseed the database (restores the scripted demo state) |
| `npx tsx scripts/eval-detective.ts` | Score the Detective on the labelled eval set |
| `npx tsx scripts/check-gemini.ts` | Smoke-test both Gemini model tiers |

Env vars: `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` (see `.env.example`). Without a Blob token, photos go straight to Gemini and only the transcription is stored.

## Repository map

```
src/app/                 routes: landing, (app)/{diagnostic,practice,today,map,reveal,mistakes,strategy,teacher,under-the-hood}, api/*
src/lib/agents/          the 7 agents + prompts/
src/lib/learner/         BKT, Elo, calibration, FSRS (+ tests)
src/lib/ai/gemini.ts     structured-output wrapper: schema → JSON → Zod, retry, timeout, cache, agent_runs logging
src/lib/db/schema.ts     Drizzle schema (13 tables)
src/components/tangent/  app UI (red-pen work, trace panel, scratchpad, map, teacher, strategy, fingerprint card)
data/                    concepts, misconceptions, question bank, few-shot seeds, eval set + results
scripts/                 seed-content, seed-db, eval-detective, check-gemini
```

## Guardrails

- The answer and solution are never shown before the student submits. The Coach explains the *mistake* first; the full solution sits behind "Show solution".
- All AI output is validated. On failure the app falls back gracefully (bank questions, tagged-distractor diagnoses, template text), never a crash or raw JSON.
- No fake precision: Tangent never predicts a CAT percentile. It shows mastery and readiness by area.
- Mastery is shown with colour **and** text and icons, never colour alone. Keyboard navigable, visible focus.
