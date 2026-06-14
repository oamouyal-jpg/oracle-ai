"use client";

import { Bot, Check, Loader2, Play, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { AgentAction } from "@/lib/api";

type OracleCanDoThisCardProps = {
  action: AgentAction | null;
  busy?: boolean;
  onApprove: () => void;
  onExecute: (forceSend?: boolean) => void;
  onCancel: () => void;
  onSimulateReply?: () => void;
  t: (key: string) => string;
};

export function OracleCanDoThisCard({
  action,
  busy,
  onApprove,
  onExecute,
  onCancel,
  onSimulateReply,
  t,
}: OracleCanDoThisCardProps) {
  if (!action) return null;

  if (action.classification === "HUMAN_ACTION") {
    return (
      <GlassCard className="border-zinc-500/20">
        <p className="text-xs uppercase tracking-wider text-zinc-500">{t("agentActions.humanAction")}</p>
        <p className="mt-2 text-sm text-zinc-300">{action.actionDescription}</p>
      </GlassCard>
    );
  }

  const canApprove = ["AWAITING_APPROVAL", "PENDING"].includes(action.status);
  const canExecute = ["APPROVED", "AWAITING_APPROVAL", "PENDING"].includes(action.status);
  const isDone = action.status === "COMPLETED";
  const isFailed = action.status === "FAILED";

  return (
    <GlassCard glow className="space-y-4 border-cyan-500/25 bg-cyan-950/10">
      <div className="flex items-center gap-2 text-cyan-300">
        <Bot className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("agentActions.oracleCanDo")}</p>
      </div>

      <div>
        <p className="text-lg font-medium text-zinc-50">{action.actionTitle}</p>
        <p className="mt-1 text-sm text-zinc-400">{action.actionDescription}</p>
        <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-600">
          {action.classification.replace(/_/g, " ")} · {action.actionType.replace(/_/g, " ")}
        </p>
      </div>

      {action.capabilities.length > 0 ? (
        <ul className="space-y-1">
          {action.capabilities.map((cap) => (
            <li key={cap} className="flex items-center gap-2 text-sm text-cyan-100/90">
              <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              {cap}
            </li>
          ))}
        </ul>
      ) : null}

      {action.stateBlocked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
          {t("agentActions.stateBlockedHint")}
        </p>
      ) : null}

      {isDone && action.executionResult?.summary ? (
        <p className="text-sm text-emerald-300/90">{String(action.executionResult.summary)}</p>
      ) : null}

      {isFailed ? (
        <p className="text-sm text-rose-300/90">{t("agentActions.failed")}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600/30 px-4 py-2 text-sm text-cyan-50 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("agentActions.approve")}
          </button>
        ) : null}
        {canExecute && !isDone ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onExecute(action.stateBlocked)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {action.stateBlocked ? t("agentActions.saveDraft") : t("agentActions.execute")}
          </button>
        ) : null}
        {canApprove || (canExecute && !isDone) ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-500"
          >
            <X className="h-4 w-4" />
            {t("agentActions.cancel")}
          </button>
        ) : null}
        {isDone && onSimulateReply ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSimulateReply}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400"
          >
            {t("agentActions.simulateReply")}
          </button>
        ) : null}
      </div>
    </GlassCard>
  );
}
