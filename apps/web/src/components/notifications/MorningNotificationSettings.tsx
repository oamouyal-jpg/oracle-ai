"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  DEFAULT_MORNING_PREFS,
  getMorningPrefs,
  registerOracleServiceWorker,
  requestNotificationPermission,
  saveMorningPrefs,
  supportsNotifications,
  type MorningNotificationPrefs,
} from "@/lib/morningNotifications";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function MorningNotificationSettings() {
  const { t } = useLocale();
  const [prefs, setPrefs] = useState<MorningNotificationPrefs>(DEFAULT_MORNING_PREFS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(getMorningPrefs());
    if (supportsNotifications()) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  const updatePrefs = (next: MorningNotificationPrefs) => {
    setPrefs(next);
    saveMorningPrefs(next);
  };

  const enableNotifications = async () => {
    setMessage(null);
    await registerOracleServiceWorker();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      updatePrefs({ ...prefs, enabled: true });
      setMessage(t("notifications.enabled"));
    } else if (result === "denied") {
      setMessage(t("notifications.denied"));
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (permission === "unsupported") {
    return (
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t("notifications.unsupported")}</p>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-white/5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
        <Bell className="h-3 w-3" />
        {t("notifications.morningTitle")}
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t("notifications.morningHint")}</p>

      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={async (e) => {
            if (e.target.checked) {
              await enableNotifications();
            } else {
              updatePrefs({ ...prefs, enabled: false });
            }
          }}
          className="rounded border-white/20"
        />
        {t("notifications.enableMorning")}
      </label>

      {prefs.enabled && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500" htmlFor="morning-time">
            {t("notifications.timeLabel")}
          </label>
          <input
            id="morning-time"
            type="time"
            value={`${String(prefs.hour).padStart(2, "0")}:${String(prefs.minute).padStart(2, "0")}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isFinite(h) && Number.isFinite(m)) {
                updatePrefs({ ...prefs, hour: h, minute: m });
              }
            }}
            className="rounded-lg bg-black/20 border border-white/10 px-2 py-1 text-xs text-zinc-200"
          />
        </div>
      )}

      {message && <p className="text-[10px] text-emerald-400">{message}</p>}
      {permission === "denied" && (
        <p className="text-[10px] text-amber-400/90">{t("notifications.denied")}</p>
      )}
    </div>
  );
}
