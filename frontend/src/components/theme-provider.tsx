"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "cip-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const effective = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    setResolvedTheme(effective);
    root.classList.remove("light", "dark");
    root.classList.add(effective);
    localStorage.setItem(storageKey, theme);
  }, [theme, mounted, storageKey]);

  React.useEffect(() => {
    if (theme !== "system" || !mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const effective = mq.matches ? "dark" : "light";
      setResolvedTheme(effective);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(effective);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, mounted]);

  const setTheme = React.useCallback(
    (value: Theme) => {
      setThemeState(value);
      if (value === "light" || value === "dark") {
        setResolvedTheme(value);
      }
    },
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
