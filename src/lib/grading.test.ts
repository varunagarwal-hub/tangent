import { describe, expect, it } from "vitest";
import { answersMatch, grade, toNumber } from "./grading";

describe("grading", () => {
  it("normalizes currency, commas, units and LaTeX", () => {
    expect(answersMatch("₹1,440", "1440")).toBe(true);
    expect(answersMatch("Rs. 1440", "₹1,440")).toBe(true);
    expect(answersMatch("14.4 km/h", "14.4")).toBe(true);
    expect(answersMatch("$\\frac{3}{4}$", "0.75")).toBe(true);
    expect(answersMatch("-4%", "-4")).toBe(true);
    expect(answersMatch("15", "14.4")).toBe(false);
    // verifier sometimes echoes the option label
    expect(answersMatch("B. 48,000", "48,000")).toBe(true);
    expect(answersMatch("(c) 14.4", "14.4")).toBe(true);
    expect(answersMatch("Option D: ₹1,500", "₹1,500")).toBe(true);
    expect(answersMatch("A. 15", "14.4")).toBe(false);
  });

  it("parses fractions", () => {
    expect(toNumber("3/4")).toBeCloseTo(0.75);
    expect(toNumber("abc")).toBeNull();
  });

  it("grades MCQ by option text or letter", () => {
    const q = { type: "MCQ" as const, answer: "₹1,440", options: ["₹1,400", "₹1,440", "₹1,460", "₹1,500"] };
    expect(grade(q, "₹1,440")).toBe(true);
    expect(grade(q, "B")).toBe(true);
    expect(grade(q, "A")).toBe(false);
    expect(grade(q, "")).toBe(false);
  });
});
