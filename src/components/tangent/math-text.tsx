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
  return tex.replace(/(^|[^\\])%/g, "$1\\%").replace(/₹/g, "\\text{₹}");
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
