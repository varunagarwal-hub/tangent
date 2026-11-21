import { describe, expect, it } from "vitest";
import {
  applyAttempt,
  blockingPrereq,
  bktUpdate,
  calibrationSummary,
  eloUpdate,
  expectedCorrect,
  fadeOpacity,
  initialConceptState,
  isReady,
  masteryBand,
  pickByDifficulty,
  posterior,
  priorFromPrereqs,
  ratingFor,
  review,
  shouldRetire,
  stepMisconception,
  targetQuestionElo,
  updateCalibration,
  updateMastery,
} from ".";

describe("BKT", () => {
  it("matches the hand-computed posterior + learning step", () => {
    // p=0.3, correct MCQ: 0.27 / (0.27 + 0.7*0.25) = 0.6067; learn: +0.7*0.15... → 0.6157
    const post = posterior(0.3, true, "MCQ");
    expect(post).toBeCloseTo(0.27 / 0.445, 6);
    expect(bktUpdate(0.3, true, "MCQ")).toBeCloseTo(post + (1 - post) * 0.15, 6);
  });

  it("raises mastery on correct and lowers it on wrong", () => {
    expect(bktUpdate(0.5, true, "MCQ")).toBeGreaterThan(0.5);
    expect(bktUpdate(0.5, false, "MCQ")).toBeLessThan(0.5);
  });

  it("gives TITA (low guess) more credit than MCQ for a correct answer", () => {
    expect(bktUpdate(0.3, true, "TITA")).toBeGreaterThan(bktUpdate(0.3, true, "MCQ"));
  });

  it("stays inside (0, 1) after many updates", () => {
    let p = 0.3;
    for (let i = 0; i < 50; i++) p = bktUpdate(p, true, "TITA");
    expect(p).toBeLessThan(1);
    for (let i = 0; i < 50; i++) p = bktUpdate(p, false, "TITA");
    expect(p).toBeGreaterThan(0);
  });

  it("half-credits right answer / flawed reasoning (midpoint of correct and incorrect updates)", () => {
    const up = bktUpdate(0.5, true, "MCQ");
    const down = bktUpdate(0.5, false, "MCQ");
    const flawed = updateMastery(0.5, { correct: true, type: "MCQ", verdict: "flawed" });
    expect(flawed).toBeCloseTo((up + down) / 2, 6);
    expect(flawed).toBeLessThan(up);
  });

  it("gives slow-but-correct 70% of the correct update", () => {
    const up = bktUpdate(0.5, true, "MCQ");
    const slow = updateMastery(0.5, { correct: true, type: "MCQ", timeRatio: 2 });
    expect(slow).toBeCloseTo(0.5 + 0.7 * (up - 0.5), 6);
    // at exactly 1.5× it's not "slow"
    expect(updateMastery(0.5, { correct: true, type: "MCQ", timeRatio: 1.5 })).toBeCloseTo(up, 6);
  });

  it("propagates priors from prerequisites", () => {
    expect(priorFromPrereqs([])).toBe(0.3);
    expect(priorFromPrereqs([1, 1])).toBeCloseTo(0.8);
    expect(priorFromPrereqs([0.2, 0.4])).toBeCloseTo(0.2 + 0.6 * 0.3);
  });

  it("blocks a concept whose prerequisite is below 0.4", () => {
    expect(isReady(["A1"], { A1: 0.35 })).toBe(false);
    expect(isReady(["A1"], { A1: 0.6 })).toBe(true);
    expect(blockingPrereq(["A2", "A3"], { A2: 0.5, A3: 0.2 })).toBe("A3");
    expect(blockingPrereq(["A2"], { A2: 0.5 })).toBeNull();
  });

  it("bands mastery for color + label", () => {
    expect(masteryBand(0.39)).toBe("low");
    expect(masteryBand(0.55)).toBe("mid");
    expect(masteryBand(0.71)).toBe("high");
    expect(masteryBand(0.5, 0)).toBe("unknown");
  });
});

describe("Elo", () => {
  it("predicts 0.5 for equal ratings and ~0.76 for a 200-point edge", () => {
    expect(expectedCorrect(1200, 1200)).toBeCloseTo(0.5);
    expect(expectedCorrect(1400, 1200)).toBeCloseTo(0.76, 2);
  });

  it("is zero-sum when K matches, and uses K=24 then K=12 for questions", () => {
    const fresh = eloUpdate(1200, 1200, true, 0);
    expect(fresh.student).toBeCloseTo(1216); // 32 * 0.5
    expect(fresh.question).toBeCloseTo(1188); // 24 * 0.5
    const settled = eloUpdate(1200, 1200, true, 10);
    expect(settled.question).toBeCloseTo(1194); // 12 * 0.5
  });

  it("makes a question harder when students miss it", () => {
    expect(eloUpdate(1300, 1200, false, 3).question).toBeGreaterThan(1200);
  });

  it("targets P(correct) = 0.65, i.e. question elo ≈ student − 108", () => {
    const q = targetQuestionElo(1300);
    expect(1300 - q).toBeCloseTo(107.6, 0);
    expect(expectedCorrect(1300, q)).toBeCloseTo(0.65, 6);
  });

  it("picks a question in the 0.6–0.7 band", () => {
    const qs = [{ difficultyElo: 900 }, { difficultyElo: 1100 }, { difficultyElo: 1200 }, { difficultyElo: 1500 }];
    expect(pickByDifficulty(1200, qs)?.difficultyElo).toBe(1100); // P ≈ 0.64
    expect(pickByDifficulty(1200, [])).toBeNull();
  });

  it("retires drifting or twice-flagged questions", () => {
    expect(shouldRetire({ difficultyElo: 2050, flagCount: 0 })).toBe(true);
    expect(shouldRetire({ difficultyElo: 550, flagCount: 0 })).toBe(true);
    expect(shouldRetire({ difficultyElo: 1200, flagCount: 2 })).toBe(true);
    expect(shouldRetire({ difficultyElo: 1200, flagCount: 1 })).toBe(false);
  });
});

describe("FSRS rating mapping", () => {
  it("maps outcomes to Again / Hard / Good / Easy", () => {
    expect(ratingFor({ correct: false })).toBe("Again");
    expect(ratingFor({ correct: false, confidence: 3, timeRatio: 0.5 })).toBe("Again");
    expect(ratingFor({ correct: true, verdict: "flawed" })).toBe("Hard");
    expect(ratingFor({ correct: true, timeRatio: 1.8 })).toBe("Hard");
    expect(ratingFor({ correct: true, confidence: 1 })).toBe("Hard");
    expect(ratingFor({ correct: true, timeRatio: 1, confidence: 2 })).toBe("Good");
    expect(ratingFor({ correct: true, timeRatio: 0.6, confidence: 3 })).toBe("Easy");
    expect(ratingFor({ correct: true, timeRatio: 0.9, confidence: 3 })).toBe("Good");
  });

  it("schedules Easy further out than Again", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    const first = review(null, "Good", now).card;
    const later = new Date("2026-11-25T10:00:00Z");
    const again = review(first, "Again", later).due.getTime();
    const easy = review(first, "Easy", later).due.getTime();
    expect(easy).toBeGreaterThan(again);
  });

  it("fades nodes as they become due", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    let card = review(null, "Good", now).card;
    card = review(card, "Good", new Date("2026-11-02T00:00:00Z")).card;
    const fresh = fadeOpacity(card, new Date("2026-11-02T01:00:00Z"));
    const stale = fadeOpacity(card, new Date("2027-01-01T00:00:00Z"));
    expect(fresh).toBeGreaterThan(stale);
    expect(stale).toBeGreaterThanOrEqual(0.35);
    expect(fadeOpacity(null)).toBe(1);
  });
});

describe("Calibration", () => {
  it("tracks overconfidence as a positive gap", () => {
    let g = 0;
    for (let i = 0; i < 10; i++) g = updateCalibration(g, 3, false);
    expect(g).toBeGreaterThan(0.8);
    expect(calibrationSummary([
      { confidence: 3, isCorrect: false },
      { confidence: 3, isCorrect: true },
    ]).gap).toBeCloseTo(0.5);
  });
});

describe("applyAttempt + misconception lifecycle", () => {
  it("updates mastery, elo, time EMA and schedules a review", () => {
    const s0 = initialConceptState(0.3);
    const r = applyAttempt(s0, {
      correct: true, type: "MCQ", verdict: "sound", timeSec: 60, targetTimeSec: 90,
      confidence: 2, questionElo: 1200, questionAttempts: 0,
    });
    expect(r.concept.pMastery).toBeGreaterThan(0.3);
    expect(r.concept.elo).toBeGreaterThan(1200);
    expect(r.questionElo).toBeLessThan(1200);
    expect(r.concept.attempts).toBe(1);
    expect(r.concept.avgTimeRatio).toBeCloseTo(60 / 90);
    expect(r.rating).toBe("Good");
    expect(r.delta).toBeGreaterThan(0);
  });

  it("resolves after 2 clean answers and reopens on recurrence", () => {
    let m = stepMisconception(null, { kind: "detected" });
    expect(m.status).toBe("detected");
    m = stepMisconception(m, { kind: "contrast_served" });
    expect(m.status).toBe("fixing");
    m = stepMisconception(m, { kind: "clean_correct" });
    expect(m.status).toBe("fixing");
    m = stepMisconception(m, { kind: "clean_correct" });
    expect(m.status).toBe("resolved");
    m = stepMisconception(m, { kind: "detected" });
    expect(m).toEqual({ status: "detected", evidenceCount: 2, cleanCount: 0 });
  });
});
