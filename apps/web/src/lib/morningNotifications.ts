import { api, type MorningNotificationPayload } from "@/lib/api";

const STORAGE_KEY = "oracle_morning_notifications";

export type MorningNotificationPrefs = {
  enabled: boolean;
  hour: number;
  minute: number;
  lastSentDate: string | null;
};

export const DEFAULT_MORNING_PREFS: MorningNotificationPrefs = {
  enabled: false,
  hour: 7,
  minute: 30,
  lastSentDate: null,
};

export function getMorningPrefs(): MorningNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_MORNING_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MORNING_PREFS;
    const parsed = JSON.parse(raw) as Partial<MorningNotificationPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      hour: Number(parsed.hour) || DEFAULT_MORNING_PREFS.hour,
      minute: Number(parsed.minute) ?? DEFAULT_MORNING_PREFS.minute,
      lastSentDate: parsed.lastSentDate ?? null,
    };
  } catch {
    return DEFAULT_MORNING_PREFS;
  }
}

export function saveMorningPrefs(prefs: MorningNotificationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function registerOracleServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supportsNotifications()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function shouldSendMorningNotification(prefs: MorningNotificationPrefs) {
  if (!prefs.enabled) return false;
  if (prefs.lastSentDate === todayKey()) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = prefs.hour * 60 + prefs.minute;
  return nowMinutes >= targetMinutes;
}

export async function showMorningNotification(payload: MorningNotificationPayload) {
  const options: NotificationOptions = {
    body: payload.body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: "oracle-morning",
    data: { url: payload.url },
  };

  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(payload.title, options);
      return;
    }
  }

  if (Notification.permission === "granted") {
    new Notification(payload.title, options);
  }
}

export async function maybeSendMorningNotification() {
  if (!supportsNotifications() || Notification.permission !== "granted") return false;

  const prefs = getMorningPrefs();
  if (!shouldSendMorningNotification(prefs)) return false;

  try {
    const payload = await api.morningNotification();
    await showMorningNotification(payload);
    saveMorningPrefs({ ...prefs, lastSentDate: todayKey() });
    return true;
  } catch {
    return false;
  }
}
