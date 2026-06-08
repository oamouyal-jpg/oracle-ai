"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { User } from "lucide-react";
import { api, type UserProfile } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { MorningNotificationSettings } from "@/components/notifications/MorningNotificationSettings";

type OperatorProfileProps = {
  className?: string;
  compact?: boolean;
};

export function OperatorProfile({ className, compact }: OperatorProfileProps) {
  const { t } = useLocale();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.userProfile();
      setProfile(data);
      setName(data.name || "");
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.updateProfile({ name: trimmed });
      setProfile(updated);
      setName(updated.name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  const patterns = profile?.strategicProfile.patterns ?? [];
  const memoryCount = profile?.memoryCount ?? 0;
  const displayName = profile?.name?.trim() || "Operator";

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
        <User className="h-3 w-3" />
        {t("profile.label")}
      </p>

      {compact ? (
        <p className="text-xs text-zinc-400">
          {displayName}
          {memoryCount > 0 && (
            <span className="text-zinc-600"> · {memoryCount} {t("profile.patternsLearned").toLowerCase()}</span>
          )}
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor="operator-name">
            {t("profile.nameLabel")}
          </label>
          <input
            id="operator-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profile.namePlaceholder")}
            maxLength={80}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim() || name.trim() === (profile?.name ?? "")}
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/20 px-2.5 py-1.5 text-xs text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-40"
          >
            {saved ? t("profile.saved") : saving ? "…" : t("profile.saveName")}
          </button>
          <p className="text-[10px] text-zinc-600 leading-relaxed">{t("profile.learningHint")}</p>
          {patterns.length > 0 ? (
            <div className="mt-1 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                {t("profile.patternsLearned")} ({memoryCount})
              </p>
              <ul className="space-y-0.5">
                {patterns.slice(0, 3).map((p) => (
                  <li key={p} className="text-[10px] text-zinc-500 leading-snug line-clamp-2">
                    · {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 italic">{t("profile.noPatternsYet")}</p>
          )}
          <MorningNotificationSettings />
        </>
      )}
    </div>
  );
}
