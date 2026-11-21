"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const ESCAPED_DOLLAR = "\u0000DOLLAR\u0000";

/** Split a string into plain-text and `$...$` / `$$...$$` math segments. */
function parse(input: string): Segment[] {
  const src = input.replace(/\\\$/g, ESCAPED_DOLLAR);
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ kind: "text", value: src.slice(last, m.index) });
    out.push({ kind: "math", value: m[1] ?? m[2], display: m[1] !== undefined });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ kind: "text", value: src.slice(last) });
  return out.map((s) => ({ ...s, value: s.value.split(ESCAPED_DOLLAR).join(s.kind === "math" ? "\\$" : "$") }));
}

/** Make student/LLM math friendlier to KaTeX: bare % is a comment in TeX, ₹ isn't a math symbol. */
function prepMath(tex: string): string {
  return tex
    .replace(/(^|[^\\])%/g, "$1\\%")
    .replace(/₹/g, "\\text{₹}")
    .replace(/(\d),(?=\d{2,3}\b)/g, "$1{,}"); // digit-group commas: 48,000 not "48, 000"
}

/**
 * Generated questions often wrap plain numbers in $...$ ("$25\%$", "$₹48{,}000$", "$3 \times 4$").
 * Rendering those in the KaTeX serif breaks the sentence's typeface, so anything that is just
 * numbers, currency, percentages and basic operators is returned as plain text instead.
 */
function asPlainText(tex: string): string | null {
  // \text{...} content is plain words (units, labels): set it aside so letters there are allowed,
  // while a bare letter (a variable like x) keeps the expression in KaTeX.
  const words: string[] = [];
  const t = tex
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, (_m, w: string) => `@${words.push(w) - 1}@`)
    .replace(/\\%/g, "%")
    .replace(/\{,\}/g, ",")
    .replace(/\\,|\\;|\\!|~/g, " ")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\le(q)?\b/g, "≤")
    .replace(/\\ge(q)?\b/g, "≥")
    .replace(/\\rightarrow|\\to\b/g, "→")
    .replace(/\\Rs\b|\\rupee\b/g, "₹")
    .trim();
  if (/[\\^_{}]/.test(t)) return null;
  if (!/^[\d\s.,%₹+\-−×·÷±=≤≥<>→:()/'@]+$/.test(t)) return null;
  return t
    .replace(/-/g, "−")
    .replace(/\s*([×÷=±≤≥<>→])\s*/g, " $1 ")
    .replace(/@(\d+)@/g, (_m, i: string) => words[Number(i)] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(prepMath(tex), { throwOnError: false, displayMode: display, strict: "ignore", output: "htmlAndMathml" });
  } catch {
    return "";
  }
}

function textWithBreaks(value: string, key: string): ReactNode {
  const parts = value.split("\n");
  return parts.map((p, i) => (
    <Fragment key={`${key}-${i}`}>
      {i > 0 && <br />}
      {p}
    </Fragment>
  ));
}

/**
 * Renders text with inline LaTeX in `$...$` (and display math in `$$...$$`).
 * Plain text is rendered as React text nodes (never as HTML); only KaTeX output is injected.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    return parse(text ?? "").map((seg, i) => {
      if (seg.kind === "text") return <Fragment key={i}>{textWithBreaks(seg.value, String(i))}</Fragment>;
      if (!seg.display) {
        const plain = asPlainText(seg.value);
        if (plain != null) return <Fragment key={i}>{plain}</Fragment>;
      }
      const html = renderMath(seg.value, seg.display);
      if (!html) return <Fragment key={i}>{`$${seg.value}$`}</Fragment>;
      return (
        <span
          key={i}
          className={cn("tg-math", seg.display && "block my-2 overflow-x-auto")}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  }, [text]);

  return <span className={cn("break-words", className)}>{nodes}</span>;
}
