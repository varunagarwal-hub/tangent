/**
 * Plain-language definitions for every bit of Tangent jargon, used by <InfoTip term="...">.
 * One sentence each, written for a student who has never heard of BKT or Elo.
 */
export const GLOSSARY = {
  mastery: {
    title: "Mastery %",
    body: "How likely it is that you've really learned this concept, based on every answer so far. It rises with right answers (more if they're fast and well-reasoned) and drops with wrong ones.",
  },
  masteryScale: {
    title: "Colours",
    body: "Red means shaky (under 40%), amber is getting there (40–70%), green is solid (over 70%). Grey dashed means not tested yet.",
  },
  review: {
    title: "Due for review",
    body: "Concepts you're about to forget. Tangent schedules a quick recall question just before that happens, which makes the memory last much longer (spaced repetition).",
  },
  nextMove: {
    title: "Next best move",
    body: "The planner scores every option (fix a mistake, drill a weak foundation, review, practise, stretch) and picks the one that helps you most right now.",
  },
  streak: {
    title: "Streak",
    body: "Days in a row you've practised. Short daily sessions beat long weekly ones.",
  },
  confidence: {
    title: "How sure are you?",
    body: "Telling us your confidence lets Tangent spot 'confidently wrong' answers, the habits that cost the most marks in CAT, and tells the Skip Coach what you should leave.",
  },
  lifecycle: {
    title: "Off on a tangent → Fixing → Back on the curve",
    body: "A mistake starts as 'Off on a tangent'. Tangent then serves questions built to test it ('Fixing'). After 2 right answers with sound reasoning it's 'Back on the curve'. If it comes back, it reopens.",
  },
  cleanAnswers: {
    title: "Clean answers",
    body: "A right answer where your working is also right. Two of these in a row close a mistake.",
  },
  tangentPoint: {
    title: "Tangent point",
    body: "The exact line in your working where the reasoning went wrong. Everything before it was fine.",
  },
  skipCoach: {
    title: "Skip Coach",
    body: "Replays your past answers with CAT's real marking (+3 right, −1 wrong MCQ, 0 for wrong TITA) to show whether skipping some questions would have scored more.",
  },
  calibration: {
    title: "Calibration",
    body: "How well your confidence matches your accuracy. If you say 'Certain' but get it wrong often, you're overconfident in that area.",
  },
  heatmap: {
    title: "Class heatmap",
    body: "Each cell is one student's mastery of one concept: red is shaky, amber is getting there, green is solid, a dash means not tested. Look for red columns: those are class-wide gaps.",
  },
  atRisk: {
    title: "At-risk students",
    body: "Students well below the class on high-weight concepts, or carrying several active mistakes. Worth a check-in.",
  },
  detectiveLearned: {
    title: "Detective learned",
    body: "When you correct a diagnosis in the override queue, it becomes an example the Detective studies, so it diagnoses that mistake better for every student.",
  },
  overrideQueue: {
    title: "Override queue",
    body: "Diagnoses the Detective wasn't sure about. Confirm or relabel them; each correction teaches the Detective.",
  },
  leaderboard: {
    title: "Misconception leaderboard",
    body: "The mistakes most students in the class are making right now, with how many are affected and whether it's growing.",
  },
  elo: {
    title: "Difficulty rating",
    body: "Every question and every student has a rating, like chess. Tangent picks questions you have about a 60–70% chance of getting right: hard enough to learn from, not so hard you guess.",
  },
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
