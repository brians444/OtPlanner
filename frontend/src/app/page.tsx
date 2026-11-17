"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccess } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getAccess() ? "/tablero" : "/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Cargando PlannerOT…
    </div>
  );
}