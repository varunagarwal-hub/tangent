"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Compass, GraduationCap, HelpCircle, Loader2, MenuIcon, RotateCcw, Sparkles, UserRound } from "lucide-react";
import { openDemoGuide, openTour } from "@/components/tangent/demo-guide/events";
import { ResetDemoDialog } from "@/components/tangent/demo-guide/reset-demo";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type PersonaKeyLite = "riya" | "mehta" | "new";
export interface HeaderPersona {
  key: PersonaKeyLite;
  name: string;
  role: "student" | "teacher";
}

const STUDENT_NAV = [
  { href: "/today", label: "Today" },
  { href: "/practice", label: "Practice" },
  { href: "/map", label: "Map" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/strategy", label: "Strategy" },
];
const TEACHER_NAV = [{ href: "/teacher", label: "Teacher" }];

const PERSONA_OPTIONS: { key: PersonaKeyLite; label: string; sub: string; home: string; Icon: typeof UserRound }[] = [
  { key: "riya", label: "Riya", sub: "Student", home: "/today", Icon: UserRound },
  { key: "mehta", label: "Prof. Mehta", sub: "Teacher", home: "/teacher", Icon: GraduationCap },
  { key: "new", label: "New student", sub: "Start fresh", home: "/onboarding", Icon: Sparkles },
];

const HELP_ITEMS = [
  { key: "tour", label: "How Tangent works", sub: "Quick tour for students or teachers", Icon: HelpCircle },
  { key: "demo", label: "Guided demo", sub: "Step-by-step checklist of the best parts", Icon: Compass },
  { key: "reset", label: "Reset demo", sub: "Put Riya back to her scripted state", Icon: RotateCcw },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({ items, pathname, onNavigate, vertical }: { items: typeof STUDENT_NAV; pathname: string; onNavigate?: () => void; vertical?: boolean }) {
  return (
    <ul className={cn("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-1.5 text-sm transition-colors hover:text-ink",
                vertical && "py-2.5 text-base",
                active ? "font-medium text-ink" : "text-ink-soft",
              )}
            >
              <span className={cn(active && "hand-underline")}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PersonaSwitcher({ persona, onReset }: { persona: HeaderPersona; onReset: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<PersonaKeyLite | null>(null);

  async function choose(key: PersonaKeyLite) {
    const opt = PERSONA_OPTIONS.find((p) => p.key === key)!;
    setBusy(key);
    try {
      await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: key }),
      });
      router.push(opt.home);
      router.refresh();
    } catch (e) {
      console.error("persona switch failed", e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        render={<Button variant="outline" size="sm" className="h-8 max-w-[11rem] gap-1.5" aria-label={`Persona: ${persona.name} (${persona.role}). Switch persona`} />}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : persona.role === "teacher" ? <GraduationCap aria-hidden="true" /> : <UserRound aria-hidden="true" />}
        <span className="truncate">{persona.name}</span>
        <ChevronDown className="opacity-60" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="paper-card min-w-56 p-1 text-sm outline-none origin-(--transform-origin) transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-ink-soft">Switch persona</div>
            {PERSONA_OPTIONS.map((p) => {
              const current = p.key === persona.key;
              return (
                <Menu.Item
                  key={p.key}
                  onClick={() => choose(p.key)}
                  disabled={busy !== null}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-ink outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent"
                >
                  <p.Icon className="size-4 text-ink-soft" aria-hidden="true" />
                  <span className="flex flex-1 flex-col leading-tight">
                    <span>{p.label}</span>
                    <span className="text-xs text-ink-soft">{p.sub}</span>
                  </span>
                  {current && (
                    <>
                      <Check className="size-4 text-redpen" aria-hidden="true" />
                      <span className="sr-only">(current)</span>
                    </>
                  )}
                </Menu.Item>
              );
            })}
            <div className="my-1 border-t border-dashed border-border" role="separator" />
            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-ink-soft">Help</div>
            {HELP_ITEMS.map((h) => (
              <Menu.Item
                key={h.label}
                onClick={h.key === "reset" ? onReset : h.key === "tour" ? openTour : openDemoGuide}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-ink outline-none select-none data-highlighted:bg-accent"
              >
                <h.Icon className="size-4 text-ink-soft" aria-hidden="true" />
                <span className="flex flex-1 flex-col leading-tight">
                  <span>{h.label}</span>
                  <span className="text-xs text-ink-soft">{h.sub}</span>
                </span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Top bar: logo, role-based nav with a hand-drawn active underline, persona switcher, theme toggle. */
export function AppHeader({ persona, className }: { persona: HeaderPersona; className?: string }) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const items = persona.role === "teacher" ? TEACHER_NAV : STUDENT_NAV;

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-paper", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="rounded-md" aria-label="Tangent home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden md:block">
          <NavLinks items={items} pathname={pathname} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <PersonaSwitcher persona={persona} onReset={() => setResetOpen(true)} />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="bg-paper">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="px-2">
                <NavLinks items={items} pathname={pathname} vertical onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="mt-4 border-t border-dashed px-2 pt-3">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-ink-soft">Help</p>
                {HELP_ITEMS.map((h) => (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (h.key === "reset") setResetOpen(true);
                      else if (h.key === "tour") openTour();
                      else openDemoGuide();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-base text-ink hover:bg-accent"
                  >
                    <h.Icon className="size-4 text-ink-soft" aria-hidden="true" />
                    {h.label}
                  </button>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t p-4">
                <span className="text-sm text-ink-soft">Theme</span>
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <ResetDemoDialog open={resetOpen} onOpenChange={setResetOpen} />
    </header>
  );
}
