"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { navItems } from "./navConfig";
import { ShareButton } from "./ShareButton";

type MobileHeaderProps = {
  onOpenMenu: () => void;
};

export function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  const pathname = usePathname();
  const { t } = useLocale();

  const current =
    navItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href))
    ) ?? navItems[0];

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-white/5 glass-strong px-4 pt-[env(safe-area-inset-top)] md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t("mobile.menu")}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link href="/" className="flex flex-col items-center min-w-0 flex-1 px-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-300/80">Oracle</span>
        <span className="text-sm font-medium text-zinc-100 truncate max-w-[12rem]">
          {t(current.key)}
        </span>
      </Link>

      <ShareButton />
    </header>
  );
}
