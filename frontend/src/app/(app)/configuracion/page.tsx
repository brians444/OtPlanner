"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Moon, PanelLeft, Sun, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/modal";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useNavLayout } from "@/hooks/use-nav-layout";
import { useTableStyle, type TableStyle } from "@/hooks/use-table-style";
import { apiBase } from "@/lib/api";
import { apiError } from "@/lib/api";
import { excelService } from "@/lib/services";

const tableOptions: { value: TableStyle; label: string }[] = [
  { value: "default", label: "Estándar" },
  { value: "striped", label: "Alternado" },
  { value: "bordered", label: "Con bordes" },
  { value: "compact", label: "Compacto" },
];

export default function ConfiguracionPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { layout, setLayout } = useNavLayout();
  const { tableStyle, setTableStyle } = useTableStyle();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const doExport = async () => {
    setBusy("export"); setError(""); setMsg("");
    try {
      await excelService.download();
      setMsg("Excel exportado con todas las hojas del Planner.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (!pendingFile) return;
    setBusy("import"); setError(""); setMsg("");
    try {
      const r = await excelService.import(pendingFile, true);
      const counts = r && typeof r === "object"
        ? Object.entries(r).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k}: ${v}`).join(" · ")
        : "";
      setMsg(`Importación completa. ${counts}`);
      qc.invalidateQueries();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(null);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Preferencias de interfaz (se guardan en este navegador) y datos.</p>
        </div>

        {msg && <Alert><AlertDescription>{msg}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Apariencia</CardTitle>
            <CardDescription>Tema claro u oscuro.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />Claro
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />Oscuro
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Navegación</CardTitle>
            <CardDescription>Barra superior o sidebar lateral.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={layout === "top" ? "default" : "outline"} size="sm" onClick={() => setLayout("top")}>
              Barra superior
            </Button>
            <Button variant={layout === "sidebar" ? "default" : "outline"} size="sm" onClick={() => setLayout("sidebar")}>
              <PanelLeft className="mr-2 h-4 w-4" />Sidebar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estilo de tablas</CardTitle>
            <CardDescription>Se aplica a etiquetas, listas, personal y usuarios.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tableOptions.map((o) => (
              <Button key={o.value} variant={tableStyle === o.value ? "default" : "outline"} size="sm"
                onClick={() => setTableStyle(o.value)}>
                {o.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />Excel
            </CardTitle>
            <CardDescription>
              Exportá toda la base a un .xlsx compatible con el Planner original.
              {user?.is_admin ? " La importación reemplaza todos los datos actuales." : " La importación requiere administrador."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={doExport} disabled={busy !== null}>
              {busy === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar .xlsx
            </Button>
            {user?.is_admin && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                  {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar .xlsx…
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conexión</CardTitle>
            <CardDescription>Backend configurado en public/runtime-config.js.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn("font-mono text-sm rounded-md border bg-muted/40 px-3 py-2")}>{apiBase()}</p>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={!!pendingFile} title="Importar Excel"
        message={<>Se importará <b>{pendingFile?.name}</b> y se <b>reemplazarán todos los datos actuales</b> (proyectos, actividades, checklist, personal, etc.). Esta acción no se puede deshacer.</>}
        confirmLabel="Importar y reemplazar" destructive
        onConfirm={doImport}
        onCancel={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }} />
    </div>
  );
}