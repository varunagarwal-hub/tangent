"use client";

import { useId, useRef, useState } from "react";
import { BookOpenCheck, Camera, Check, ImageUp, Keyboard, Loader2, PenLine, TriangleAlert, X } from "lucide-react";
import type { WorkPayload } from "@/lib/api-types";
import { compressImage } from "@/lib/compress-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Scratchpad } from "./scratchpad";
import { cn } from "@/lib/utils";

export interface WorkSample {
  id: string;
  label: string;
  text: string;
  imageUrl?: string;
}

type Tab = "scratchpad" | "type" | "upload" | "sample";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Couldn't read the file."));
    r.readAsDataURL(blob);
  });
}

function tabFor(source: WorkPayload["source"]): Tab {
  return source === "type" || source === "upload" || source === "sample" ? source : "scratchpad";
}

/** Rough-work input: Scratchpad | Type | Upload photo | Use sample. Each tab emits its own WorkPayload. */
export function WorkInput({
  value,
  onChange,
  samples = [],
  disabled,
  className,
}: {
  value: WorkPayload;
  onChange: (next: WorkPayload) => void;
  samples?: WorkSample[];
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>(tabFor(value.source));
  // per-tab memory so switching tabs restores (and re-emits) what that tab holds
  const [typed, setTyped] = useState(value.source === "type" ? (value.text ?? "") : "");
  const [drawing, setDrawing] = useState<string | null>(value.source === "scratchpad" ? (value.imageDataUrl ?? null) : null);
  const [photo, setPhoto] = useState<string | null>(value.source === "upload" ? (value.imageDataUrl ?? null) : null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function emitFor(t: Tab) {
    if (t === "type") onChange(typed.trim() ? { text: typed, source: "type" } : { source: "none" });
    else if (t === "scratchpad") onChange(drawing ? { imageDataUrl: drawing, source: "scratchpad" } : { source: "none" });
    else if (t === "upload") onChange(photo ? { imageDataUrl: photo, source: "upload" } : { source: "none" });
    else if (t === "sample") {
      if (value.source === "sample") return;
      onChange({ source: "none" });
      setSampleId(null);
    }
  }

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("That file type isn't supported. Use a JPEG, PNG or WebP photo.");
      return;
    }
    setBusy("upload");
    try {
      const blob = await compressImage(file);
      const url = await blobToDataUrl(blob);
      setPhoto(url);
      onChange({ imageDataUrl: url, source: "upload" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo. Try another one.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pickSample(s: WorkSample) {
    setError(null);
    setSampleId(s.id);
    if (!s.imageUrl) {
      onChange({ text: s.text, source: "sample" });
      return;
    }
    setBusy("sample");
    try {
      const res = await fetch(s.imageUrl);
      if (!res.ok) throw new Error(String(res.status));
      const url = await blobToDataUrl(await res.blob());
      onChange({ text: s.text, imageDataUrl: url, source: "sample" });
    } catch {
      // fall back to the text alone; the reasoning is still checkable
      onChange({ text: s.text, source: "sample" });
      setError("Couldn't load the sample photo, so only its text will be sent.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const t = v as Tab;
          setTab(t);
          setError(null);
          emitFor(t);
        }}
      >
        <TabsList className="grid h-auto! w-full grid-cols-4 gap-0.5 p-1">
          <TabsTrigger value="scratchpad" disabled={disabled} className="h-auto flex-col gap-0.5 py-1.5 text-xs sm:flex-row sm:gap-1.5 sm:text-sm">
            <PenLine aria-hidden="true" /> Scratchpad
          </TabsTrigger>
          <TabsTrigger value="type" disabled={disabled} className="h-auto flex-col gap-0.5 py-1.5 text-xs sm:flex-row sm:gap-1.5 sm:text-sm">
            <Keyboard aria-hidden="true" /> Type
          </TabsTrigger>
          <TabsTrigger value="upload" aria-label="Upload photo" disabled={disabled} className="h-auto flex-col gap-0.5 py-1.5 text-xs sm:flex-row sm:gap-1.5 sm:text-sm">
            <Camera aria-hidden="true" /> <span>Upload<span className="hidden sm:inline"> photo</span></span>
          </TabsTrigger>
          <TabsTrigger value="sample" aria-label="Use sample rough work" disabled={disabled} className="h-auto flex-col gap-0.5 py-1.5 text-xs sm:flex-row sm:gap-1.5 sm:text-sm">
            <BookOpenCheck aria-hidden="true" /> <span><span className="hidden sm:inline">Use </span>sample</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scratchpad" keepMounted className="pt-1 data-hidden:hidden">
          <Scratchpad
            disabled={disabled}
            onChange={(url) => {
              setDrawing(url);
              onChange(url ? { imageDataUrl: url, source: "scratchpad" } : { source: "none" });
            }}
          />
        </TabsContent>

        <TabsContent value="type" className="pt-1">
          <label htmlFor={`${id}-typed`} className="sr-only">
            Your rough work, one step per line
          </label>
          <Textarea
            id={`${id}-typed`}
            value={typed}
            disabled={disabled}
            rows={6}
            placeholder={"1. Price after 20% rise = 1.2P\n2. …"}
            className="min-h-40 bg-card font-mono text-sm leading-7"
            onChange={(e) => {
              setTyped(e.target.value);
              onChange(e.target.value.trim() ? { text: e.target.value, source: "type" } : { source: "none" });
            }}
          />
        </TabsContent>

        <TabsContent value="upload" className="pt-1">
          <input
            ref={fileRef}
            id={`${id}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || busy === "upload"}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {photo ? (
            <div className="relative overflow-hidden rounded-lg border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Preview of your uploaded rough work" className="max-h-80 w-full object-contain" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 bg-card"
                disabled={disabled}
                onClick={() => {
                  setPhoto(null);
                  onChange({ source: "none" });
                }}
              >
                <X aria-hidden="true" /> Remove
              </Button>
            </div>
          ) : (
            <label
              htmlFor={`${id}-file`}
              className={cn(
                "graph-paper flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-ink-soft transition-colors hover:border-ink/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-redpen",
                disabled && "pointer-events-none opacity-60",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!disabled) onFile(e.dataTransfer.files?.[0]);
              }}
            >
              {busy === "upload" ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <ImageUp className="size-6" aria-hidden="true" />}
              <span className="text-sm font-medium text-ink">{busy === "upload" ? "Compressing photo…" : "Take or choose a photo of your rough work"}</span>
              <span className="text-xs">JPEG, PNG or WebP. Big photos are shrunk on your device first.</span>
            </label>
          )}
        </TabsContent>

        <TabsContent value="sample" className="pt-1">
          {samples.length === 0 ? (
            <p className="text-sm text-ink-soft">No samples for this question.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {samples.map((s) => {
                const active = sampleId === s.id && value.source === "sample";
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={disabled || busy === "sample"}
                      onClick={() => pickSample(s)}
                      className={cn(
                        "paper-card flex h-full w-full flex-col gap-1 p-3 text-left transition-colors hover:border-ink/40 disabled:opacity-60",
                        active && "border-ink ring-1 ring-ink",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wider text-ink-soft">
                        {s.label}
                        {active && (
                          <span className="inline-flex items-center gap-1 text-ink normal-case tracking-normal">
                            <Check className="size-3.5" aria-hidden="true" /> Selected
                          </span>
                        )}
                        {busy === "sample" && sampleId === s.id && <Loader2 className="size-3.5 animate-spin" aria-label="Loading sample" />}
                      </span>
                      <span className="font-hand text-xl leading-snug whitespace-pre-line text-ink">{s.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-redpen">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      <p className="text-xs text-ink-soft">Show your rough work: Tangent checks your reasoning, not just the answer.</p>
    </div>
  );
}
