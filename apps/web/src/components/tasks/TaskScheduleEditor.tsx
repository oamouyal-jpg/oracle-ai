"use client";

import { useState } from "react";
import type { Task } from "@/lib/api";
import {
  defaultReminderIso,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/taskScheduling";

type Props = {
  task?: Task;
  initialTitle?: string;
  onSave: (data: {
    title?: string;
    dueDate: string | null;
    scheduledAt: string | null;
    reminderAt: string | null;
  }) => Promise<void>;
  onCancel?: () => void;
  createMode?: boolean;
  t: (key: string) => string;
};

export function TaskScheduleEditor({
  task,
  initialTitle = "",
  onSave,
  onCancel,
  createMode,
  t,
}: Props) {
  const [title, setTitle] = useState(task?.title ?? initialTitle);
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate));
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocalValue(task?.scheduledAt));
  const [remind, setRemind] = useState(Boolean(task?.reminderAt));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (createMode && !title.trim()) return;
    setBusy(true);
    try {
      let reminderAt: string | null = null;
      if (remind && dueDate) {
        reminderAt = defaultReminderIso(dueDate, scheduledAt || undefined);
      } else if (remind && scheduledAt) {
        reminderAt = new Date(scheduledAt).toISOString();
      }

      await onSave({
        ...(createMode ? { title: title.trim() } : {}),
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        reminderAt: remind ? reminderAt : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      {createMode ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("tasks.newTaskPlaceholder")}
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100"
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          {t("tasks.deadline")}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500">
          {t("tasks.scheduleFor")}
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={remind}
          onChange={(e) => setRemind(e.target.checked)}
          disabled={!dueDate && !scheduledAt}
        />
        {t("tasks.remindMe")}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || (createMode && !title.trim())}
          onClick={() => void submit()}
          className="rounded-lg bg-indigo-500/30 px-4 py-2 text-xs text-indigo-100 disabled:opacity-40"
        >
          {createMode ? t("tasks.addTask") : t("tasks.saveSchedule")}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500"
          >
            {t("common.cancel")}
          </button>
        ) : null}
        {!createMode && (dueDate || scheduledAt) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSave({
                dueDate: null,
                scheduledAt: null,
                reminderAt: null,
              })
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-600"
          >
            {t("tasks.clearDates")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
