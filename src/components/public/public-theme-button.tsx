"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function PublicThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => toggleTheme(false)}
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema"
      className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </button>
  );
}
