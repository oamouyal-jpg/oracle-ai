"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Send } from "lucide-react";
import {
  DEFAULT_MORNING_PREFS,
  getMorningPrefs,
  saveMorningPrefs,
  supportsNotifications,
} from "@/lib/morningNotifications";
import { disablePush, enablePush, isPushSubscribed, supportsPush } from "@/lib/webPush";
import { api, type NotificationPrefs, type NotificationPrefsUpdate } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function MorningNotificationSettings() {
  const { t } = useLocale();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(supportsPush() || supportsNotifications());
    isPushSubscribed().then(setSubscribed).catch(() => {});
    api.notificationPrefs().then(setPrefs).catch(() => {});
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const refresh = async () => {
    const next = await api.notificationPrefs().catch(() => null);
    if (next) setPrefs(next);
  };

  const patch = async (data: Partial<NotificationPrefsUpdate>) => {
    setPrefs((p) => (p ? { ...p, ...data } : p));
    await api.updateNotificationPrefs(data).catch(() => {});
  };

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enablePush();
    setBusy(false);
    if (result === "ok") {
      setSubscribed(true);
      // keep the foreground poller aligned as a fallback
      saveMorningPrefs({ ...getMorningPrefs(), enabled: true });
      await refresh();
      flash(t("notifications.pushActive"));
    } else if (result === "denied") {
      flash(t("notifications.denied"));
    } else if (result === "unsupported") {
      flash(t("notifications.unsupported"));
    } else {
      flash(t("notifications.pushError"));
    }
  };

  const disable = async () => {
    setBusy(true);
    await disablePush();
    saveMorningPrefs({ ...DEFAULT_MORNING_PREFS });
    setSubscribed(false);
    await refresh();
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await api.testPush().catch(() => ({ ok: false, delivered: 0 }));
    setBusy(false);
    flash(res.ok ? t("notifications.testSent") : t("notifications.pushError"));
  };

  if (!supported) {
    return (
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t("notifications.unsupported")}</p>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="space-y-3 pt-2 border-t border-white/5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
        <Bell className="h-3 w-3" />
        {t("notifications.pushTitle")}
      </div>
      <p className="text-[10px] text-zinc-600 leading-relaxed">{t("notifications.pushHint")}</p>

      {!subscribed ? (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <BellRing className="h-3.5 w-3.5" />
          {t("notifications.enablePush")}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400">
            <span className="flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              {t("notifications.pushActive")}
            </span>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
            >
              {t("notifications.disable")}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs?.proactiveEnabled ?? true}
              onChange={(e) => patch({ proactiveEnabled: e.target.checked })}
              className="rounded border-white/20"
            />
            {t("notifications.proactiveLabel")}
          </label>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500 w-20" htmlFor="morning-time">
              {t("notifications.morningTimeLabel")}
            </label>
            <input
              id="morning-time"
              type="time"
              value={`${pad(prefs?.morningHour ?? 7)}:${pad(prefs?.morningMinute ?? 30)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) {
                  patch({ morningHour: h, morningMinute: m });
                  saveMorningPrefs({ ...getMorningPrefs(), hour: h, minute: m });
                }
              }}
              className="rounded-lg bg-black/20 border border-white/10 px-2 py-1 text-xs text-zinc-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500 w-20">{t("notifications.quietHours")}</label>
            <input
              type="time"
              value={`${pad(prefs?.quietHoursStart ?? 22)}:00`}
              onChange={(e) => {
                const h = Number(e.target.value.split(":")[0]);
                if (Number.isFinite(h)) patch({ quietHoursStart: h });
              }}
              className="rounded-lg bg-black/20 border border-white/10 px-2 py-1 text-xs text-zinc-200"
            />
            <span className="text-[10px] text-zinc-600">{t("notifications.to")}</span>
            <input
              type="time"
              value={`${pad(prefs?.quietHoursEnd ?? 7)}:00`}
              onChange={(e) => {
                const h = Number(e.target.value.split(":")[0]);
                if (Number.isFinite(h)) patch({ quietHoursEnd: h });
              }}
              className="rounded-lg bg-black/20 border border-white/10 px-2 py-1 text-xs text-zinc-200"
            />
          </div>

          <button
            type="button"
            onClick={sendTest}
            disabled={busy}
            className="flex items-center gap-1.5 text-[10px] text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            {t("notifications.test")}
          </button>
        </div>
      )}

      {message && <p className="text-[10px] text-emerald-400">{message}</p>}
    </div>
  );
}
