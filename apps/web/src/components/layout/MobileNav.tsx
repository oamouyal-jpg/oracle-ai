"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MoreHorizontal, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { mobileTabItems, navItems } from "./navConfig";
import { ShareButton, InstallHint } from "./ShareButton";
import { OperatorProfile } from "./OperatorProfile";

type MobileNavProps = {
  menuOpen: boolean;
  onCloseMenu: () => void;
  onOpenMenu: () => void;
};

export function MobileNav({ menuOpen, onCloseMenu, onOpenMenu }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useLocale();

  const moreActive = navItems.some(
    (item) =>
      !mobileTabItems.some((tab) => tab.href === item.href) &&
      (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)))
  );

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMenu}
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 start-0 z-[70] flex w-[min(100vw-3rem,18rem)] flex-col border-e border-white/10 glass-strong transition-transform duration-300 md:hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          menuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div>
            <p className="text-sm font-semibold tracking-widest text-zinc-100 uppercase">Oracle</p>
            <p className="text-[10px] text-zinc-500">{t("sidebar.lifeOs")}</p>
          </div>
          <button
            type="button"
            onClick={onCloseMenu}
            aria-label={t("common.cancel")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMenu}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all",
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

        <div className="px-4 py-4 border-t border-white/5 space-y-3">
          <OperatorProfile />
          <ShareButton variant="pill" className="w-full justify-center" />
          <InstallHint />
          <LanguageSwitcher />
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-white/10 glass-strong pb-[env(safe-area-inset-bottom)] md:hidden">
        {mobileTabItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] transition-colors",
                active ? "text-indigo-300" : "text-zinc-500"
              )}
            >
              <Icon className={clsx("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(129,140,248,0.6)]")} />
              <span className="truncate max-w-[4.5rem] px-0.5">
                {item.key === "nav.clarity" ? t("nav.clarityShort") : t(item.key).split(" ")[0]}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className={clsx(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] transition-colors",
            moreActive || menuOpen ? "text-indigo-300" : "text-zinc-500"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t("mobile.more")}</span>
        </button>
      </nav>
    </>
  );
}
