"use client";

import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { TeacherClassData, TeacherStudentRow } from "@/lib/api-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { band, BAND_LABEL, pct } from "./shared";

const AREA_ORDER = ["Arithmetic", "Number System", "Algebra", "Geometry", "Modern Math"];

type SortKey = "name" | "avg" | string; // string = conceptId
type Sort = { key: SortKey; dir: "asc" | "desc" };

type Concept = TeacherClassData["concepts"][number];

function cellClass(p: number | null | undefined) {
  return `tg-cell tg-cell-${band(p)}`;
}

function cellLabel(student: string, c: Concept, p: number | null | undefined) {
  return `${student}, ${c.id} ${c.name}: ${p == null ? "untested" : `${pct(p)} mastery, ${BAND_LABEL[band(p)]}`}`;
}

export function Heatmap({ data, onOpenStudent }: { data: TeacherClassData; onOpenStudent: (id: string) => void }) {
  const [sort, setSort] = useState<Sort>({ key: "avg", dir: "asc" });
  const [showNums, setShowNums] = useState(true);
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const gridRef = useRef<HTMLTableElement>(null);

  const groups = useMemo(() => {
    const byArea = new Map<string, Concept[]>();
    for (const c of data.concepts) {
      const list = byArea.get(c.area) ?? [];
      list.push(c);
      byArea.set(c.area, list);
    }
    const areas = [...byArea.keys()].sort((a, b) => {
      const ia = AREA_ORDER.indexOf(a);
      const ib = AREA_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return areas.map((area) => ({ area, concepts: byArea.get(area)! }));
  }, [data.concepts]);

  const concepts = useMemo(() => groups.flatMap((g) => g.concepts), [groups]);
  const groupStart = useMemo(() => new Set(groups.map((g) => g.concepts[0]?.id)), [groups]);

  const rows = useMemo(() => {
    const val = (s: TeacherStudentRow): number | string | null => {
      if (sort.key === "name") return s.name.toLowerCase();
      if (sort.key === "avg") return s.avgMastery;
      return data.heat[s.id]?.[sort.key] ?? null;
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...data.students].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      // untested always sinks to the bottom
      if (va == null && vb == null) return a.name.localeCompare(b.name);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") return sign * va.localeCompare(vb);
      return sign * ((va as number) - (vb as number)) || a.name.localeCompare(b.name);
    });
  }, [data.students, data.heat, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }, []);

  const onGridKey = useCallback(
    (e: KeyboardEvent<HTMLTableElement>) => {
      const target = e.target as HTMLElement;
      const rc = target.dataset.cell;
      if (!rc) return;
      const [r, c] = rc.split("-").map(Number);
      let nr = r;
      let nc = c;
      if (e.key === "ArrowRight") nc = Math.min(concepts.length - 1, c + 1);
      else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
      else if (e.key === "ArrowDown") nr = Math.min(rows.length - 1, r + 1);
      else if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
      else if (e.key === "Home") nc = 0;
      else if (e.key === "End") nc = concepts.length - 1;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const s = rows[r];
        if (s) onOpenStudent(s.id);
        return;
      } else return;
      e.preventDefault();
      setActive({ r: nr, c: nc });
      gridRef.current?.querySelector<HTMLElement>(`[data-cell="${nr}-${nc}"]`)?.focus();
    },
    [concepts.length, rows, onOpenStudent],
  );

  const sortIcon = (key: SortKey) =>
    sort.key !== key ? (
      <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
    ) : sort.dir === "asc" ? (
      <ArrowUp className="size-3 text-redpen" aria-hidden="true" />
    ) : (
      <ArrowDown className="size-3 text-redpen" aria-hidden="true" />
    );
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");

  const sortLabel = sort.key === "name" ? "name" : sort.key === "avg" ? "average mastery" : `${sort.key}`;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        {/* controls */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Sort:</span>
          <div role="group" aria-label="Sort students" className="inline-flex overflow-hidden rounded-lg border">
            {(
              [
                ["name", "Name"],
                ["avg", "Avg mastery"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                aria-pressed={sort.key === key}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs transition-colors",
                  sort.key === key ? "bg-ink text-paper" : "bg-card text-ink hover:bg-accent",
                )}
              >
                {label}
                {sort.key === key && (sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-ink-soft">
            sorted by {sortLabel}, {sort.dir === "asc" ? "lowest first" : "highest first"}
            {sort.key === "name" && (sort.dir === "asc" ? " (A→Z)" : " (Z→A)")}
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={showNums} onChange={(e) => setShowNums(e.target.checked)} className="size-3.5 accent-[var(--redpen)]" />
            Show % in every cell
          </label>
        </div>

        <div
          className="tg-heat-scroll relative max-h-[70vh] overflow-auto rounded-lg border bg-card"
          tabIndex={0}
          role="region"
          aria-label="Mastery heatmap, scrolls horizontally"
        >
          <table
            ref={gridRef}
            className="border-separate border-spacing-0 text-xs"
            onKeyDown={onGridKey}
            aria-label={`Mastery by student and concept, sorted by ${sortLabel}`}
          >
            <thead>
              <tr className="h-6">
                <th scope="col" rowSpan={2} className="sticky top-0 left-0 z-30 border-b border-r bg-card px-2 text-left align-bottom">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 rounded py-1.5 font-sans text-xs font-semibold text-ink"
                    aria-sort={ariaSort("name")}
                  >
                    Student {sortIcon("name")}
                  </button>
                </th>
                {groups.map((g) => (
                  <th
                    key={g.area}
                    scope="colgroup"
                    colSpan={g.concepts.length}
                    className="sticky top-0 z-20 h-6 border-l border-ink/15 bg-card px-1 text-left text-xs font-medium whitespace-nowrap text-ink-soft"
                  >
                    {g.area}
                  </th>
                ))}
              </tr>
              <tr>
                {concepts.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ariaSort(c.id)}
                    className={cn("sticky top-6 z-20 border-b bg-card p-0", groupStart.has(c.id) && "border-l border-l-ink/15")}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => toggleSort(c.id)}
                            aria-label={`Sort by ${c.id} ${c.name}`}
                            className={cn(
                              "flex w-9 flex-col items-center gap-0.5 py-1 font-mono text-[0.68rem] text-ink hover:text-redpen",
                              sort.key === c.id && "font-bold text-redpen",
                            )}
                          />
                        }
                      >
                        {c.id}
                        {sortIcon(c.id)}
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="flex flex-col">
                          <span className="font-medium">{c.name}</span>
                          <span className="opacity-80">
                            {c.area} · weight {c.weight} · class avg {pct(data.conceptAvg[c.id])}
                          </span>
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* class average */}
              <tr className="tg-heat-avg">
                <th scope="row" className="sticky left-0 z-10 border-r border-b-2 border-b-ink/30 bg-paper-deep px-2 py-1.5 text-left">
                  <span className="text-sm font-medium leading-none text-ink">Class average</span>
                </th>
                {concepts.map((c) => {
                  const p = data.conceptAvg[c.id];
                  return (
                    <td
                      key={c.id}
                      className={cn("border-b-2 border-b-ink/30 bg-paper-deep p-[2px]", groupStart.has(c.id) && "border-l border-l-ink/15")}
                    >
                      <div className={cn(cellClass(p), "tg-cell-show")} role="img" aria-label={`Class average, ${c.id} ${c.name}: ${p == null ? "untested" : pct(p)}`}>
                        {p == null ? "–" : Math.round(p * 100)}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {rows.map((s, r) => (
                <HeatRow
                  key={s.id}
                  s={s}
                  r={r}
                  concepts={concepts}
                  groupStart={groupStart}
                  heat={data.heat[s.id]}
                  showNums={showNums}
                  activeC={active.r === r ? active.c : -1}
                  onOpen={onOpenStudent}
                  onFocusCell={setActive}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          {(["low", "mid", "high", "unknown"] as const).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className={cn("tg-cell inline-block !h-3.5 !w-5", `tg-cell-${b}`)} aria-hidden="true" />
              {BAND_LABEL[b]} {b === "low" ? "(<40%)" : b === "mid" ? "(40–70%)" : b === "high" ? "(>70%)" : "(hatched)"}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-redpen" aria-hidden="true" /> at risk
          </span>
          <span className="text-xs font-medium">Arrow keys move between cells · Enter opens the student</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

const HeatRow = memo(function HeatRow({
  s,
  r,
  concepts,
  groupStart,
  heat,
  showNums,
  activeC,
  onOpen,
  onFocusCell,
}: {
  s: TeacherStudentRow;
  r: number;
  concepts: Concept[];
  groupStart: Set<string | undefined>;
  heat: Record<string, number | null> | undefined;
  showNums: boolean;
  activeC: number;
  onOpen: (id: string) => void;
  onFocusCell: (v: { r: number; c: number }) => void;
}) {
  return (
    <tr className="group/row">
      <th scope="row" className="sticky left-0 z-10 border-r bg-card px-1 py-0.5 text-left group-hover/row:bg-accent">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(s.id)}
            className="max-w-[7.5rem] truncate rounded px-1 py-0.5 text-left text-xs font-medium text-ink hover:text-redpen hover:underline sm:max-w-[10rem]"
            title={`Open ${s.name}`}
          >
            {s.name}
          </button>
          {s.atRisk && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${s.name} is at risk: ${s.riskReasons.join(", ") || "flagged"}`}
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full"
                  />
                }
              >
                <span className="size-2 rounded-full bg-redpen ring-2 ring-redpen/25" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex flex-col">
                  <span className="font-medium">At risk</span>
                  {s.riskReasons.map((x) => (
                    <span key={x}>· {x}</span>
                  ))}
                </span>
              </TooltipContent>
            </Tooltip>
          )}
          <span className="ml-auto pl-1 font-mono text-[0.65rem] text-ink-soft tabular-nums">{pct(s.avgMastery)}</span>
        </div>
      </th>
      {concepts.map((c, ci) => {
        const p = heat?.[c.id] ?? null;
        return (
          <td key={c.id} className={cn("p-[2px]", groupStart.has(c.id) && "border-l border-l-ink/15")}>
            <div
              data-cell={`${r}-${ci}`}
              tabIndex={activeC === ci ? 0 : -1}
              role="button"
              aria-label={cellLabel(s.name, c, p)}
              title={`${s.name} · ${c.name}: ${p == null ? "untested" : pct(p)}`}
              onFocus={() => onFocusCell({ r, c: ci })}
              onDoubleClick={() => onOpen(s.id)}
              className={cn(cellClass(p), showNums && "tg-cell-show")}
            >
              {p == null ? "–" : Math.round(p * 100)}
            </div>
          </td>
        );
      })}
    </tr>
  );
});
