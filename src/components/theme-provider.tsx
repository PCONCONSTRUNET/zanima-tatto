"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

export type AppTheme = "light" | "dark";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (next: AppTheme, persistServer?: boolean) => void;
  toggleTheme: (persistServer?: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === "zanima-theme") callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getClientSnapshot(): AppTheme {
  try {
    const saved = localStorage.getItem("zanima-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return "dark";
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: AppTheme;
}) {
  const theme = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    () => initialTheme ?? "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme, persistServer = true) => {
    try {
      localStorage.setItem("zanima-theme", next);
    } catch {}
    document.documentElement.setAttribute("data-theme", next);
    listeners.forEach((cb) => cb());

    if (persistServer) {
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreference: next === "dark" ? "DARK" : "LIGHT",
        }),
      }).catch(() => {});
    }
  }, []);

  const toggleTheme = useCallback(
    (persistServer = true) => {
      setTheme(theme === "light" ? "dark" : "light", persistServer);
    },
    [setTheme, theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
