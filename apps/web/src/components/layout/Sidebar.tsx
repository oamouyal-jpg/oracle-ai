"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ShareButton, InstallButton, InstallHint } from "./ShareButton";
import { OperatorProfile } from "./OperatorProfile";
import { navItems } from "./navConfig";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="fixed start-0 top-0 z-40 hidden h-screen w-56 flex-col border-e border-white/5 glass-strong md:flex">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex h-full flex-col"
      >
        <motion.div className="px-5 py-6 border-b border-white/5">
          <motion.div className="flex items-center gap-2">
            <motion.div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-xs font-bold">
              O
            </motion.div>
            <motion.div>
              <h1 className="text-sm font-semibold uppercase tracking-widest text-zinc-100">Oracle</h1>
              <p className="text-[10px] tracking-wider text-zinc-500">{t("sidebar.lifeOs")}</p>
            </motion.div>
          </motion.div>
        </motion.div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
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
                    ? "border border-indigo-500/30 bg-indigo-500/20 text-indigo-200"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <motion.div className="space-y-3 border-t border-white/5 px-4 py-4">
          <OperatorProfile />
          <InstallButton />
          <ShareButton variant="pill" className="w-full justify-center" />
          <InstallHint />
          <LanguageSwitcher />
        </motion.div>
      </motion.div>
    </aside>
  );
}
