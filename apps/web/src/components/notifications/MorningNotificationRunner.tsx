"use client";

import { useEffect } from "react";
import {
  maybeSendMorningNotification,
  registerOracleServiceWorker,
} from "@/lib/morningNotifications";

export function MorningNotificationRunner() {
  useEffect(() => {
    registerOracleServiceWorker().catch(() => {});

    const tick = () => {
      maybeSendMorningNotification().catch(() => {});
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
