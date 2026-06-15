"use client";

import Link from "next/link";
import { Bot, Check, Copy, Loader2, Play, X } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { AgentAction } from "@/lib/api";
import { getAgentDraftContent, isDraftActionType } from "@/lib/agentDraft";

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
  const [copied, setCopied] = useState(false);

  if (!action) return null;

  if (action.classification === "HUMAN_ACTION") {
    return (
      <GlassCard className="border-zinc-500/20">
        <p className="text-xs uppercase tracking-wider text-zinc-500">{t("agentActions.humanAction")}</p>
        <p className="mt-2 text-sm text-zinc-300">{action.actionDescription}</p>
      </GlassCard>
    );
  }

  const draft = getAgentDraftContent(action);
  const isDraftType = isDraftActionType(action.actionType);
  const canApprove = ["AWAITING_APPROVAL", "PENDING"].includes(action.status);
  const canExecute = ["APPROVED", "AWAITING_APPROVAL", "PENDING"].includes(action.status);
  const isDone = action.status === "COMPLETED";
  const isFailed = action.status === "FAILED";
  const isApproved = action.status === "APPROVED";

  const copyDraft = async () => {
    if (!draft) return;
    const text = draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassCard glow className="space-y-4 border-cyan-500/25 bg-cyan-950/10">
      <div className="flex items-center gap-2 text-cyan-300">
        <Bot className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("agentActions.oracleCanDo")}</p>
        {isDone ? (
          <span className="ms-auto rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-300">
            {t("agentActions.statusCompleted")}
          </span>
        ) : null}
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

      {isApproved && !draft && isDraftType ? (
        <p className="text-sm text-cyan-200/90">{t("agentActions.approvedRunHint")}</p>
      ) : null}

      {draft ? (
        <div className="rounded-xl border border-cyan-500/20 bg-black/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
              {t("agentActions.yourDraft")}
            </p>
            <button
              type="button"
              onClick={() => void copyDraft()}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              <Copy className="h-3 w-3" />
              {copied ? t("agentActions.copied") : t("agentActions.copyDraft")}
            </button>
          </div>
          {draft.subject ? (
            <p className="text-sm font-medium text-zinc-200">{draft.subject}</p>
          ) : null}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 font-sans">
            {draft.body}
          </pre>
        </div>
      ) : null}

      {isDone && action.executionResult?.summary && !draft ? (
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
            {isDraftType ? t("agentActions.approveAndWrite") : t("agentActions.approve")}
          </button>
        ) : null}
        {canExecute && !isDone && !isDraftType ? (
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
        {isApproved && isDraftType && !isDone ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onExecute(action.stateBlocked)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {t("agentActions.generateDraft")}
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

      {isDone || draft ? (
        <Link href="/agent-actions" className="inline-block text-xs text-cyan-300/80 hover:text-cyan-200">
          {t("agentActions.viewAllActions")} →
        </Link>
      ) : null}
    </GlassCard>
  );
}
