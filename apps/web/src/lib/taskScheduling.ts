import { api, type TaskReminderPayload } from "@/lib/api";

export async function maybeSendTaskReminders() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  try {
    const reminders = await api.taskReminders();
    if (reminders.length === 0) return false;

    for (const reminder of reminders) {
      await showTaskReminderNotification(reminder);
      await api.ackTaskReminder(reminder.taskId);
    }
    return true;
  } catch {
    return false;
  }
}

async function showTaskReminderNotification(payload: TaskReminderPayload) {
  const options: NotificationOptions = {
    body: payload.body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `oracle-task-${payload.taskId}`,
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

/** Default reminder: 9:00 local on due date, or 1 hour from now if that's past. */
export function defaultReminderIso(dueDateLocal: string, scheduledLocal?: string): string {
  if (scheduledLocal) {
    const s = new Date(scheduledLocal);
    if (!Number.isNaN(s.getTime())) return s.toISOString();
  }
  const parts = dueDateLocal.split("-").map(Number);
  if (parts.length < 3) return new Date(Date.now() + 3600000).toISOString();
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!, 9, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    return new Date(Date.now() + 3600000).toISOString();
  }
  return d.toISOString();
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTaskDueLabel(
  iso: string | null | undefined,
  t: (key: string) => string,
  locale: string
): { text: string; overdue: boolean; dueToday: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const dueToday = d.toDateString() === new Date().toDateString();
  const endOfDueDay = new Date(d);
  endOfDueDay.setHours(23, 59, 59, 999);
  const overdue = endOfDueDay.getTime() < Date.now() && !dueToday;

  const dateStr = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  let text: string;
  if (overdue) text = `${t("tasks.overdue")} · ${dateStr}`;
  else if (dueToday) text = t("tasks.dueToday");
  else text = `${t("tasks.deadline")}: ${dateStr}`;

  return { text, overdue, dueToday };
}
