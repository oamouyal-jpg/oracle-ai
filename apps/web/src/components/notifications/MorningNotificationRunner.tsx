"use client";

import { useEffect } from "react";
import {
  maybeSendMorningNotification,
  registerOracleServiceWorker,
} from "@/lib/morningNotifications";
import { maybeSendTaskReminders } from "@/lib/taskScheduling";
import { isPushSubscribed } from "@/lib/webPush";

export function MorningNotificationRunner() {
  useEffect(() => {
    registerOracleServiceWorker().catch(() => {});

    const tick = async () => {
      // When server-side web push is active it handles all delivery (even when
      // the app is closed), so skip the foreground poller to avoid duplicates.
      if (await isPushSubscribed()) return;
      maybeSendMorningNotification().catch(() => {});
      maybeSendTaskReminders().catch(() => {});
    };

    tick();
    const interval = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
