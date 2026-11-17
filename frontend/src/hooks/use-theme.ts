"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "theme";
const EVT = "plannerot:theme";

function apply(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme) || "light";
    setThemeState(saved);
    apply(saved);
    setIsLoaded(true);
    const onChange = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      setThemeState(t);
      apply(t);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        setThemeState(e.newValue as Theme);
        apply(e.newValue as Theme);
      }
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t);
    apply(t);
    setThemeState(t);
    window.dispatchEvent(new CustomEvent(EVT, { detail: t }));
  }, []);

  return { theme, setTheme, isLoaded };
}