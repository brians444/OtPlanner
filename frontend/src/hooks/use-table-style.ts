"use client";

import { useCallback, useEffect, useState } from "react";

export type TableStyle = "default" | "striped" | "bordered" | "compact";
const KEY = "table_style";
const EVT = "plannerot:tablestyle";

export const tableStyles: Record<TableStyle, { tableClass: string; rowClass: string; cellClass: string }> = {
  default: { tableClass: "", rowClass: "hover:bg-muted/50", cellClass: "py-3" },
  striped: { tableClass: "", rowClass: "even:bg-muted/30 hover:bg-muted/50", cellClass: "py-3" },
  bordered: { tableClass: "[&_th]:border [&_td]:border", rowClass: "hover:bg-muted/50", cellClass: "py-3" },
  compact: { tableClass: "text-xs", rowClass: "hover:bg-muted/50", cellClass: "py-1.5 px-2" },
};

export function useTableStyle() {
  const [tableStyle, setTableStyleState] = useState<TableStyle>("default");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as TableStyle) || "default";
    if (saved in tableStyles) setTableStyleState(saved);
    const onChange = (e: Event) => setTableStyleState((e as CustomEvent<TableStyle>).detail);
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const setTableStyle = useCallback((s: TableStyle) => {
    localStorage.setItem(KEY, s);
    setTableStyleState(s);
    window.dispatchEvent(new CustomEvent(EVT, { detail: s }));
  }, []);

  return { tableStyle, setTableStyle };
}