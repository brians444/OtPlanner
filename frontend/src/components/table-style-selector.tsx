"use client";

import { AlignJustify, Grid2x2, Rows3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableStyle, type TableStyle } from "@/hooks/use-table-style";

const options: { value: TableStyle; label: string; Icon: typeof Table2 }[] = [
  { value: "default", label: "Estándar", Icon: Table2 },
  { value: "striped", label: "Alternado", Icon: Rows3 },
  { value: "bordered", label: "Con bordes", Icon: Grid2x2 },
  { value: "compact", label: "Compacto", Icon: AlignJustify },
];

export function TableStyleSelector() {
  const { tableStyle, setTableStyle } = useTableStyle();
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => setTableStyle(value)}
          className={cn(
            "rounded p-1.5 transition-colors",
            tableStyle === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}