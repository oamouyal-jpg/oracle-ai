"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Activity,
  Layers,
  Target,
  CheckSquare,
  Sun,
  Moon,
  Map,
  MessageSquare,
  Zap,
  BookOpen,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navKeys = [
  { href: "/", key: "nav.commandCenter", icon: LayoutDashboard },
  { href: "/life-map", key: "nav.lifeMap", icon: Map },
  { href: "/domains", key: "nav.domains", icon: Layers },
  { href: "/alignment", key: "nav.alignment", icon: Activity },
  { href: "/missions", key: "nav.missions", icon: Target },
  { href: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { href: "/briefing", key: "nav.briefing", icon: Sun },
  { href: "/debrief", key: "nav.debrief", icon: Moon },
  { href: "/chat", key: "nav.chat", icon: MessageSquare },
  { href: "/execute", key: "nav.execute", icon: Zap },
  { href: "/journal", key: "nav.journal", icon: BookOpen },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="fixed start-0 top-0 z-40 flex h-screen w-56 flex-col border-e border-white/5 glass-strong">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col h-full"
      >
        <motion.div className="px-5 py-6 border-b border-white/5">
          <motion.div className="flex items-center gap-2">
            <motion.div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-xs font-bold">
              O
            </motion.div>
            <motion.div>
              <h1 className="text-sm font-semibold tracking-widest text-zinc-100 uppercase">
                Oracle
              </h1>
              <p className="text-[10px] text-zinc-500 tracking-wider">{t("sidebar.lifeOs")}</p>
            </motion.div>
          </motion.div>
        </motion.div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-0.5">
          {navKeys.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <motion.div className="px-4 py-4 border-t border-white/5 space-y-3">
          <LanguageSwitcher />
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
              {t("sidebar.strategicMode")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">{t("sidebar.operatorActive")}</p>
          </div>
        </motion.div>
      </motion.div>
    </aside>
  );
}
