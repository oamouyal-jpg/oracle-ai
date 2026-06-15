import type { AgentAction } from "@/lib/api";

export function getAgentDraftContent(action: AgentAction): {
  subject?: string;
  body: string;
} | null {
  const artifacts = (action.executionResult?.artifacts ?? {}) as Record<string, unknown>;
  const payload = action.payload ?? {};

  const body = String(
    artifacts.body ?? artifacts.preview ?? payload.draftBody ?? payload.body ?? ""
  ).trim();
  const subject = String(
    artifacts.subject ?? payload.draftSubject ?? payload.subject ?? ""
  ).trim();

  if (!body && !subject) return null;
  return { subject: subject || undefined, body: body || subject };
}

export function isDraftActionType(actionType: string): boolean {
  return (
    actionType.includes("DRAFT") ||
    actionType === "GENERATE_REPORT" ||
    actionType === "GENERATE_PDF" ||
    actionType === "HYBRID_PREP"
  );
}
