"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Light (graph paper) ↔ chalkboard toggle. Persists to localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("tangent-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label={dark ? "Switch to paper theme" : "Switch to chalkboard theme"}>
      <span className="font-hand text-lg">{dark ? "paper" : "chalkboard"}</span>
    </Button>
  );
}
