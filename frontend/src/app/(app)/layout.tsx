"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAccess } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const hasToken = typeof window !== "undefined" && !!getAccess();

  useEffect(() => {
    if (!hasToken) router.replace("/login");
  }, [hasToken, router]);

  if (!hasToken) return null;
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}