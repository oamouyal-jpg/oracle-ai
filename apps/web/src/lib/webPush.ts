import { api } from "@/lib/api";
import { getStoredLocale } from "@/lib/i18n/messages";
import {
  registerOracleServiceWorker,
  requestNotificationPermission,
} from "@/lib/morningNotifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function supportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type PushEnableResult = "ok" | "denied" | "unsupported" | "error";

export async function enablePush(): Promise<PushEnableResult> {
  if (!supportsPush()) return "unsupported";

  const reg = await registerOracleServiceWorker();
  if (!reg) return "error";

  const permission = await requestNotificationPermission();
  if (permission === "unsupported") return "unsupported";
  if (permission !== "granted") return "denied";

  try {
    const { key, configured } = await api.vapidPublicKey();
    if (!configured || !key) return "error";

    const ready = await navigator.serviceWorker.ready;
    let sub = await ready.pushManager.getSubscription();
    if (!sub) {
      sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }

    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "error";

    await api.subscribePush({
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: getStoredLocale(),
      userAgent: navigator.userAgent,
    });
    return "ok";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const ready = await navigator.serviceWorker.ready;
    const sub = await ready.pushManager.getSubscription();
    if (sub) {
      await api.unsubscribePush(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const ready = await navigator.serviceWorker.ready;
    return Boolean(await ready.pushManager.getSubscription());
  } catch {
    return false;
  }
}
