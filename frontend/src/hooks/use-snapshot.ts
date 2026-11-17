"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiBase, getAccess } from "@/lib/api";
import { snapshotService } from "@/lib/services";
import type { Snapshot } from "@/lib/types";

export function useSnapshot() {
  const qc = useQueryClient();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = getAccess();
      if (!token || closed) return;
      const url = apiBase().replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}&topics=data`;
      ws = new WebSocket(url);
      ws.onmessage = () => {
        qc.invalidateQueries({ queryKey: ["snapshot"] });
      };
      ws.onclose = (e) => {
        if (!closed && e.code !== 4401) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [qc]);

  return useQuery<Snapshot>({
    queryKey: ["snapshot"],
    queryFn: () => snapshotService.get(),
    staleTime: 30 * 1000,
  });
}

export const EMPTY_SNAPSHOT: Snapshot = {
  proyectos: [], actividades: [], comentarios: [], subtareas: [], checklist: [],
  hitos: [], etiquetas: [], listas: [], personal: [], ausencias: [], historial: [],
};