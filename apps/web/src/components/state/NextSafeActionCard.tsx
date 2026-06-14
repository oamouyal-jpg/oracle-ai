"use client";

import { Shield } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

type NextSafeActionCardProps = {
  action: string;
  t: (key: string) => string;
};

export function NextSafeActionCard({ action, t }: NextSafeActionCardProps) {
  return (
    <GlassCard glow className="border-emerald-500/25 bg-emerald-950/10">
      <div className="flex items-center gap-2 text-emerald-300">
        <Shield className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wider">{t("stateCheck.nextSafeAction")}</p>
      </div>
      <p className="mt-3 text-lg leading-relaxed text-emerald-50/95">{action}</p>
    </GlassCard>
  );
}
