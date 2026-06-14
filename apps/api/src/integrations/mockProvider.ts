import type { AgentActionType } from "@prisma/client";
import type { AgentExecutionInput, AgentExecutionOutput, IntegrationProvider } from "./types.js";

function mockArtifact(type: AgentActionType, input: AgentExecutionInput): Record<string, unknown> {
  const body = String(input.payload.body ?? input.payload.draftBody ?? "");
  const subject = String(input.payload.subject ?? input.payload.draftSubject ?? input.title);

  switch (type) {
    case "DRAFT_EMAIL":
    case "SEND_EMAIL":
      return {
        kind: "email",
        subject,
        body: body || `[Draft prepared for: ${input.title}]\n\n${input.description}`,
        status: type === "SEND_EMAIL" ? "sent_mock" : "draft_saved",
        to: input.payload.to ?? "recipient@example.com",
      };
    case "DRAFT_MESSAGE":
      return {
        kind: "message",
        body: body || `Draft message for: ${input.title}`,
        status: "draft_saved",
        channel: input.payload.channel ?? "whatsapp",
      };
    case "BOOK_APPOINTMENT":
    case "CREATE_CALENDAR_EVENT":
      return {
        kind: "calendar",
        title: input.title,
        status: "request_drafted",
        suggestedSlots: input.payload.suggestedSlots ?? ["Tomorrow 10:00", "Tomorrow 14:00"],
      };
    case "SCHEDULE_REMINDER":
      return {
        kind: "reminder",
        remindAt: input.payload.remindAt ?? "in 24 hours",
        note: input.description,
      };
    case "GENERATE_REPORT":
    case "GENERATE_PDF":
      return {
        kind: "document",
        title: input.title,
        pages: 2,
        preview: `Summary report: ${input.description}`,
      };
    case "RESEARCH_PROVIDERS":
    case "PREPARE_COMPARISON":
    case "CREATE_CONTACT_LIST":
      return {
        kind: "research",
        results: input.payload.results ?? [
          { name: "Provider A", note: "Recommended — fast response" },
          { name: "Provider B", note: "Lower cost option" },
        ],
      };
    case "FOLLOW_UP":
    case "TRACK_RESPONSES":
      return {
        kind: "follow_up",
        trackingId: `trk_${Date.now()}`,
        status: "monitoring",
      };
    default:
      return { kind: "generic", note: input.description };
  }
}

export const mockProvider: IntegrationProvider = {
  id: "mock",
  category: "communication",
  label: "Oracle Mock Executor (MVP)",
  isConfigured: () => true,
  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const type = input.actionType as AgentActionType;
    const artifacts = mockArtifact(type, input);
    const isComm = ["SEND_EMAIL", "DRAFT_EMAIL", "DRAFT_MESSAGE"].includes(type);
    const isDraft = type.includes("DRAFT") || artifacts.status === "draft_saved";

    return {
      success: true,
      summary: isDraft
        ? `Draft prepared — ready for your review.`
        : `Oracle completed: ${input.title}`,
      artifacts,
      followUpExpected: isComm && !isDraft,
      followUpHint: isComm
        ? "Watch for a reply — Oracle will suggest the next move when a response arrives."
        : undefined,
    };
  },
};
