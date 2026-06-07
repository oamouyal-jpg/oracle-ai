"use client";

import { useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import { clsx } from "clsx";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ShareButtonProps = {
  className?: string;
  variant?: "icon" | "pill";
};

export function ShareButton({ className, variant = "icon" }: ShareButtonProps) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = t("share.title");
    const text = t("share.text");

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("share.copyPrompt"), url);
    }
  }

  const Icon = copied ? Check : Share2;

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleShare}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10",
          className
        )}
      >
        <Icon className="h-4 w-4" />
        {copied ? t("share.copied") : t("share.button")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={t("share.button")}
      title={copied ? t("share.copied") : t("share.button")}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function InstallHint() {
  const { t } = useLocale();
  const [show, setShow] = useState(false);

  if (typeof window === "undefined") return null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

  if (isStandalone) return null;

  return (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-400"
    >
      <Link2 className="h-3 w-3" />
      {show ? t("share.installHint") : t("share.addToHome")}
    </button>
  );
}
