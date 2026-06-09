"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileNav } from "./MobileNav";
import { MorningNotificationRunner } from "@/components/notifications/MorningNotificationRunner";

const AUTH_PATHS = ["/login", "/signup", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { loading } = useAuth();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  return (
    <LocaleProvider>
      {isAuthPage ? (
        children
      ) : loading ? (
        <div className="min-h-screen flex items-center justify-center text-zinc-500 hud-grid">
          …
        </div>
      ) : (
        <>
          <MorningNotificationRunner />
          <motion.div className="relative min-h-screen hud-grid">
            <Sidebar />
            <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
            <MobileNav
              menuOpen={menuOpen}
              onOpenMenu={() => setMenuOpen(true)}
              onCloseMenu={() => setMenuOpen(false)}
            />
            <main className="min-h-screen md:ps-56 pt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
              <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
                {children}
              </div>
            </main>
          </motion.div>
        </>
      )}
    </LocaleProvider>
  );
}
