"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { clearTokens, getAccess, setTokens } from "@/lib/api";
import { authService } from "@/lib/services";
import type { User } from "@/lib/types";

export function useAuth() {
  const router = useRouter();
  const qc = useQueryClient();
  const hasToken = typeof window !== "undefined" && !!getAccess();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: () => authService.me(),
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(async (username: string, password: string) => {
    const t = await authService.login(username, password);
    setTokens(t.access_token, t.refresh_token);
    await qc.invalidateQueries({ queryKey: ["me"] });
    router.push("/tablero");
  }, [qc, router]);

  const logout = useCallback(() => {
    clearTokens();
    qc.clear();
    router.push("/login");
  }, [qc, router]);

  return { user: user ?? null, isLoading: hasToken && isLoading, login, logout };
}