"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = [number, number, number];
interface Stroke {
  points: Point[];
  simulate: boolean;
}

const EXPORT_INK = "#1b2a4a";

function strokePath(stroke: Stroke): Path2D | null {
  const outline = getStroke(stroke.points, {
    size: 3.2,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: stroke.simulate,
    last: true,
  });
  if (outline.length < 2) return null;
  let d = `M ${outline[0][0].toFixed(2)} ${outline[0][1].toFixed(2)} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
  }
  return new Path2D(d + " Z");
}

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], color: string, scale: number, w: number, h: number, background?: string) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = color;
  for (const s of strokes) {
    const p = strokePath(s);
    if (p) ctx.fill(p);
  }
}

/**
 * Freehand rough-work canvas (perfect-freehand). Exports a PNG on a white background with dark ink
 * on every pointerup so vision models can read it in either theme; onChange(null) when empty.
 */
export function Scratchpad({
  onChange,
  height = 320,
  disabled,
  className,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  disabled?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ink = getComputedStyle(canvas).getPropertyValue("--ink").trim() || EXPORT_INK;
    const all = currentRef.current ? [...strokesRef.current, currentRef.current] : strokesRef.current;
    const { w, h, dpr } = sizeRef.current;
    paint(ctx, all, ink, dpr, w, h);
  }, []);

  // DPR-aware sizing
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // repaint ink when the theme flips (paper ↔ chalkboard)
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [redraw]);

  const exportPng = useCallback((): string | null => {
    if (strokesRef.current.length === 0) return null;
    const { w, h } = sizeRef.current;
    if (!w || !h) return null;
    const scale = 2;
    const off = document.createElement("canvas");
    off.width = Math.round(w * scale);
    off.height = Math.round(h * scale);
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    paint(ctx, strokesRef.current, EXPORT_INK, scale, w, h, "#ffffff");
    return off.toDataURL("image/png");
  }, []);

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "pen" ? e.pressure || 0.5 : 0.5];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentRef.current = { points: [pointFrom(e)], simulate: e.pointerType !== "pen" };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = currentRef.current;
    if (!cur) return;
    const native = e.nativeEvent;
    const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    if (events.length > 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      for (const ev of events) cur.points.push([ev.clientX - rect.left, ev.clientY - rect.top, ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5]);
    } else {
      cur.points.push(pointFrom(e));
    }
    redraw();
  }

  function onPointerUp() {
    const cur = currentRef.current;
    if (!cur) return;
    currentRef.current = null;
    strokesRef.current = [...strokesRef.current, cur];
    setCount(strokesRef.current.length);
    redraw();
    onChange(exportPng());
  }

  function undo() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setCount(strokesRef.current.length);
    redraw();
    onChange(exportPng());
  }

  function clear() {
    strokesRef.current = [];
    currentRef.current = null;
    setCount(0);
    redraw();
    onChange(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={wrapRef}
        className={cn("graph-paper relative w-full overflow-hidden rounded-lg border", disabled && "opacity-60")}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Scratchpad for rough work, ${count} ${count === 1 ? "stroke" : "strokes"}. Draw with a finger, stylus or mouse. Prefer the keyboard? Use the Type tab.`}
          className={cn("absolute inset-0 h-full w-full touch-none select-none", disabled ? "cursor-not-allowed" : "cursor-crosshair")}
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
        />
        {count === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-hand text-xl text-ink-soft/70">
            Work it out here, one step per line
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-soft" aria-live="polite">
          {count} {count === 1 ? "stroke" : "strokes"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={disabled || count === 0}>
            <Undo2 aria-hidden="true" /> Undo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled || count === 0}>
            <Eraser aria-hidden="true" /> Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
