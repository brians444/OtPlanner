"use client";

import { useState } from "react";
import { useNavLayout } from "@/hooks/use-nav-layout";
import { useTheme } from "@/hooks/use-theme";
import { Navbar, MobileNav } from "./navbar";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { layout, collapsed, isLoaded } = useNavLayout();
  useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isLoaded) return <>{children}</>;

  if (layout === "sidebar") {
    return (
      <>
        <Sidebar />
        <div
          style={{ marginLeft: collapsed ? 64 : 240 }}
          className="transition-all duration-200 min-h-screen"
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar onMenu={() => setMobileOpen(true)} />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      {children}
    </>
  );
}