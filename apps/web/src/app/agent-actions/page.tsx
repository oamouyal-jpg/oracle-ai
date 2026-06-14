"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { OracleCanDoThisCard } from "@/components/agent/OracleCanDoThisCard";
import { api, type AgentAction } from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function AgentActionsPage() {
  const { t, locale } = useLocale();
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api.agentActions().then(setActions).catch(console.error);

  useEffect(() => {
    load();
  }, [locale]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-light text-zinc-50 glow-text">{t("agentActions.title")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("agentActions.subtitle")}</p>
      </header>

      {actions.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-zinc-500">{t("agentActions.noActions")}</p>
          <Link href="/clarity" className="mt-3 inline-block text-sm text-indigo-300">
            {t("clarity.title")} →
          </Link>
        </GlassCard>
      ) : (
        actions.map((action) => (
          <OracleCanDoThisCard
            key={action.id}
            action={action}
            busy={busyId === action.id}
            t={t}
            onApprove={async () => {
              setBusyId(action.id);
              try {
                await api.approveAgentAction(action.id);
                load();
              } finally {
                setBusyId(null);
              }
            }}
            onExecute={async (force) => {
              setBusyId(action.id);
              try {
                await api.executeAgentAction(action.id, force);
                load();
              } finally {
                setBusyId(null);
              }
            }}
            onCancel={async () => {
              setBusyId(action.id);
              try {
                await api.cancelAgentAction(action.id);
                load();
              } finally {
                setBusyId(null);
              }
            }}
            onSimulateReply={
              action.status === "COMPLETED"
                ? async () => {
                    setBusyId(action.id);
                    try {
                      await api.followThroughAgentAction(action.id, {
                        eventType: "response_received",
                        eventSummary: "Reply received.",
                      });
                      load();
                    } finally {
                      setBusyId(null);
                    }
                  }
                : undefined
            }
          />
        ))
      )}
    </div>
  );
}
