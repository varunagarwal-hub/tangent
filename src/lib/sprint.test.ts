import { describe, expect, it } from "vitest";
import { CATEGORIES, GENERATORS, checkAnswer, makeRound, rng, type SprintKind } from "./sprint";

const kinds = Object.keys(GENERATORS) as SprintKind[];

describe("sprint generators", () => {
  it("are deterministic for a seed", () => {
    expect(makeRound(42)).toEqual(makeRound(42));
    expect(makeRound(42)).not.toEqual(makeRound(43));
  });

  it("never repeat a prompt within a round, in any category", () => {
    for (const c of CATEGORIES) {
      for (let seed = 1; seed <= 30; seed++) {
        const round = makeRound(seed, c.id);
        expect(new Set(round.map((i) => i.prompt)).size).toBe(round.length);
        expect(round.length).toBeGreaterThanOrEqual(25); // a strong player does ~25–30 in a minute
        for (const i of round) expect(c.kinds).toContain(i.kind);
      }
    }
  });

  it("accept their own answer and reject a nearby wrong one", () => {
    const r = rng(7);
    for (const k of kinds) {
      for (let n = 0; n < 200; n++) {
        const item = { id: "x", kind: k, ...GENERATORS[k](r) };
        expect(checkAnswer(item, String(item.answer))).toBe(true);
        expect(checkAnswer(item, String(item.answer + 1))).toBe(false);
      }
    }
  });

  it("compute the maths correctly (spot checks by recomputing from the prompt)", () => {
    const r = rng(99);
    for (let n = 0; n < 300; n++) {
      const sq = GENERATORS.square(r);
      const b = Number(sq.prompt.replace("²", ""));
      expect(sq.answer).toBe(b * b);

      const cu = GENERATORS.cube(r);
      expect(cu.answer).toBe(Number(cu.prompt.replace("³", "")) ** 3);

      const pc = GENERATORS.pct_change(r);
      const [x, y] = pc.prompt.match(/\d+/g)!.map(Number);
      const upFirst = pc.prompt.startsWith("+");
      const up = upFirst ? x : y;
      const down = upFirst ? y : x;
      expect(pc.answer).toBeCloseTo((1 + up / 100) * (1 - down / 100) * 100 - 100, 2);

      const d = GENERATORS.discount(r);
      const [a, c] = d.prompt.match(/\d+/g)!.map(Number);
      expect(d.answer).toBeCloseTo(100 - (100 - a) * (1 - c / 100), 2);

      const ra = GENERATORS.ratio(r);
      const [total, p, q] = ra.prompt.replace(/,/g, "").match(/\d+/g)!.map(Number);
      const part = ra.prompt.includes("larger") ? (total * q) / (p + q) : (total * p) / (p + q);
      expect(ra.answer).toBe(part);

      const rem = GENERATORS.remainder(r);
      const [num, div] = rem.prompt.match(/\d+/g)!.map(Number);
      expect(rem.answer).toBe(num % div);
    }
  });

  it("checks typed answers leniently on format", () => {
    const pct = { id: "x", kind: "pct_change" as const, prompt: "", answer: -10, tol: 0.01, display: "" };
    expect(checkAnswer(pct, "−10")).toBe(true);
    expect(checkAnswer(pct, "-10%")).toBe(true);
    expect(checkAnswer(pct, "10")).toBe(false);
    const frac = { id: "x", kind: "frac_pct" as const, prompt: "", answer: 100 / 7, tol: 0.06, display: "" };
    expect(checkAnswer(frac, "14.28")).toBe(true);
    expect(checkAnswer(frac, "14.29")).toBe(true);
    expect(checkAnswer(frac, "14.2")).toBe(false);
    const big = { id: "x", kind: "square" as const, prompt: "", answer: 1350, tol: 0, display: "" };
    expect(checkAnswer(big, "1,350")).toBe(true);
    expect(checkAnswer(big, "")).toBe(false);
  });
});
