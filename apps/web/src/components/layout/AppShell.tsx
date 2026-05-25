"use client";

import { motion } from "framer-motion";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <motion.div className="relative min-h-screen hud-grid">
        <Sidebar />
        <main className="min-h-screen ps-56">
          <div className="relative z-10 max-w-7xl mx-auto px-8 py-8">{children}</div>
        </main>
      </motion.div>
    </LocaleProvider>
  );
}
