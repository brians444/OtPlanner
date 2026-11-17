"use client";

import { useCallback, useEffect, useState } from "react";

export type NavLayout = "sidebar" | "top";
const KEY = "nav_layout";
const EVT = "plannerot:navlayout";

export function useNavLayout() {
  const [layout, setLayoutState] = useState<NavLayout>("top");
  const [collapsed, setCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as NavLayout) || "top";
    setLayoutState(saved);
    setCollapsed(localStorage.getItem(KEY + "_collapsed") === "1");
    setIsLoaded(true);
    const onChange = (e: Event) => setLayoutState((e as CustomEvent<NavLayout>).detail);
    const onCollapse = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setLayoutState(e.newValue as NavLayout);
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener(EVT + ":collapsed", onCollapse);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener(EVT + ":collapsed", onCollapse);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLayout = useCallback((l: NavLayout) => {
    localStorage.setItem(KEY, l);
    setLayoutState(l);
    window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(KEY + "_collapsed", c ? "0" : "1");
      window.dispatchEvent(new CustomEvent(EVT + ":collapsed", { detail: !c }));
      return !c;
    });
  }, []);

  return { layout, setLayout, collapsed, toggleCollapsed, isLoaded };
}