"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FingerprintItem {
  name: string;
  conceptName: string;
  status: string; // detected | fixing | resolved
  evidenceCount: number;
  cleanCount: number;
}

export interface FingerprintData {
  studentName: string;
  items: FingerprintItem[];
  active: number;
  resolved: number;
  caught: number;
  cleanToResolve: number;
}

const W = 1080;
const H = 1350;
// Fixed "paper" palette: the card looks the same whatever theme the viewer is in.
const C = {
  paper: "#F7F5EF",
  grid: "rgba(27,42,74,0.07)",
  ink: "#1B2A4A",
  soft: "#5B6478",
  red: "#D93A2B",
  amber: "#E8A33D",
  amberInk: "#9A6212",
  green: "#2F8F5B",
  hi: "rgba(255,228,92,0.65)",
};

const STATUS: Record<string, { label: string; color: string; text?: string }> = {
  detected: { label: "Off on a tangent", color: C.red },
  fixing: { label: "Fixing", color: C.amber, text: C.amberInk },
  resolved: { label: "Back on the curve", color: C.green },
};

/** next/font hashes family names, so read the real ones off the page's utility classes. */
function readFamilies() {
  const probe = (cls: string) => {
    const el = document.createElement("span");
    el.className = cls;
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    document.body.appendChild(el);
    const f = getComputedStyle(el).fontFamily;
    el.remove();
    return f;
  };
  return { serif: probe("font-serif"), sans: probe("font-sans"), hand: probe("font-hand"), mono: probe("font-mono") };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

/** A loose, hand-drawn ellipse (two offset passes), like a red-pen circle. */
function penCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const [dr, start, end] of [
    [0, -0.2, Math.PI * 2 - 0.1],
    [6, 0.4, Math.PI * 1.3],
  ] as const) {
    ctx.beginPath();
    for (let t = start; t <= end; t += 0.04) {
      const wob = Math.sin(t * 3) * 3 + dr;
      const x = cx + (rx + wob) * Math.cos(t);
      const y = cy + (ry + wob * 0.4) * Math.sin(t) - t * 0.6;
      if (t === start) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, serif: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = C.ink;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4;
  ctx.stroke(new Path2D("M3 27 C 9 26, 13 22, 17 15 S 27 4, 37 4"));
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.6;
  ctx.stroke(new Path2D("M17 15 L 31 25"));
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(17, 15, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.ink;
  ctx.font = `${30 * (s / 1.4)}px ${serif}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("tangent", x + 44 * s, y + 26 * s);
}

function draw(canvas: HTMLCanvasElement, d: FingerprintData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const f = readFamilies();
  ctx.clearRect(0, 0, W, H);

  // paper + graph grid + notebook margin
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(217,58,43,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(110, H);
  ctx.stroke();

  const L = 150;
  const R = W - 80;
  ctx.textBaseline = "alphabetic";

  // header
  ctx.fillStyle = C.soft;
  ctx.font = `600 24px ${f.sans}`;
  ctx.fillText("MISTAKE FINGERPRINT", L, 130);
  ctx.fillStyle = C.ink;
  ctx.font = `84px ${f.serif}`;
  ctx.fillText(d.studentName, L, 222);
  ctx.fillStyle = C.red;
  ctx.font = `44px ${f.hand}`;
  ctx.fillText("where my thinking goes off on a tangent", L, 285);

  // items
  let y = 380;
  const items = d.items.slice(0, 4);
  if (items.length === 0) {
    ctx.fillStyle = C.red;
    ctx.font = `48px ${f.hand}`;
    ctx.fillText("No tangents yet. Clean reasoning so far!", L, y + 40);
  }
  items.forEach((it, i) => {
    const st = STATUS[it.status] ?? STATUS.detected;
    ctx.font = `52px ${f.serif}`;
    const lines = wrap(ctx, it.name, R - L - 40, 2);
    const nameTop = y;
    ctx.fillStyle = C.ink;
    lines.forEach((ln, k) => ctx.fillText(ln, L + 40, y + 50 + k * 58));
    if (i === 0) {
      const wMax = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
      const extra = (lines.length - 1) * 29;
      penCircle(ctx, L + 40 + wMax / 2, nameTop + 34 + extra, wMax / 2 + 24, 32 + extra);
    }
    // index numeral in the margin
    ctx.fillStyle = C.red;
    ctx.font = `44px ${f.hand}`;
    ctx.fillText(`${i + 1}.`, L - 32, y + 50);
    y += 50 + (lines.length - 1) * 58 + (i === 0 ? 62 : 46);

    // meta line
    ctx.fillStyle = C.soft;
    ctx.font = `26px ${f.sans}`;
    const meta = `${it.conceptName} · seen ${it.evidenceCount}×`;
    ctx.fillText(meta, L + 40, y);
    const metaW = ctx.measureText(meta).width;

    // status chip
    ctx.font = `600 22px ${f.sans}`;
    const chipW = ctx.measureText(st.label).width + 32;
    const cx = Math.min(L + 40 + metaW + 24, R - chipW);
    ctx.fillStyle = st.color + "22";
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx, y - 28, chipW, 38, 19);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = st.text ?? st.color;
    ctx.fillText(st.label, cx + 16, y - 2);

    // clean-answer dots
    if (it.status !== "resolved") {
      for (let k = 0; k < d.cleanToResolve; k++) {
        ctx.beginPath();
        ctx.arc(cx + chipW + 30 + k * 30, y - 9, 9, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = k < it.cleanCount ? C.green : "rgba(27,42,74,0.3)";
        ctx.fillStyle = C.green;
        if (k < it.cleanCount) ctx.fill();
        ctx.stroke();
      }
    } else {
      // red-pen tick
      ctx.save();
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.translate(cx + chipW + 20, y - 34);
      ctx.stroke(new Path2D("M5 22 C 10 26, 14 31, 18 35 C 24 24, 33 13, 44 4"));
      ctx.restore();
    }
    y += 70;
  });

  // stats strip
  const sy = H - 300;
  ctx.fillStyle = C.hi;
  ctx.fillRect(L - 10, sy - 56, R - L + 20, 84);
  ctx.fillStyle = C.ink;
  ctx.font = `40px ${f.mono}`;
  const stats = [
    [String(d.caught), "tangents caught"],
    [String(d.active), "being fixed"],
    [String(d.resolved), "back on the curve"],
  ];
  const colW = (R - L) / 3;
  stats.forEach(([n, label], i) => {
    const x = L + i * colW;
    ctx.font = `48px ${f.mono}`;
    ctx.fillStyle = i === 2 ? C.green : i === 1 ? C.amberInk : C.red;
    ctx.fillText(n, x + 10, sy);
    const nw = ctx.measureText(n).width;
    ctx.font = `24px ${f.sans}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(label, x + 22 + nw, sy - 4);
  });

  ctx.fillStyle = C.red;
  ctx.font = `40px ${f.hand}`;
  ctx.fillText("Every slip found, followed up, and fixed.", L, H - 180);

  // footer watermark
  drawLogo(ctx, L, H - 120, 1.8, f.serif);
  ctx.fillStyle = C.soft;
  ctx.font = `24px ${f.sans}`;
  const tag = "Adaptive CAT Quant prep that reads your rough work";
  ctx.fillText(tag, R - ctx.measureText(tag).width, H - 82);
}

export function FingerprintCard({ data }: { data: FingerprintData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* draw with whatever is loaded */
      }
      if (!cancelled && ref.current) {
        draw(ref.current, data);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const download = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tangent-mistake-fingerprint-${data.studentName.split(" ")[0].toLowerCase()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, [data.studentName]);

  const summary = data.items.map((it) => `${it.name} (${STATUS[it.status]?.label ?? it.status})`).join("; ");

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label={`Mistake Fingerprint card for ${data.studentName}: ${summary || "no tangents yet"}.`}
        className="paper-card aspect-[4/5] w-full max-w-sm p-0"
      />
      <div className="space-y-3">
        <p className="max-w-xs text-sm text-ink-soft">
          Your top tangents on one notebook page, sized for LinkedIn. Share what you&apos;re fixing, not just your scores.
        </p>
        <Button onClick={download} disabled={!ready}>
          <Download className="size-4" aria-hidden="true" />
          Download PNG
        </Button>
      </div>
    </div>
  );
}
