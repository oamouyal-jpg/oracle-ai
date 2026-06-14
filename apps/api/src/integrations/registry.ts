import type { AgentActionType } from "@prisma/client";
import type { IntegrationProvider, IntegrationToolId } from "./types.js";
import { INTEGRATION_CATALOG } from "./types.js";
import { mockProvider } from "./mockProvider.js";

const providers = new Map<IntegrationToolId, IntegrationProvider>([
  ["mock", mockProvider],
]);

export function registerProvider(provider: IntegrationProvider) {
  providers.set(provider.id, provider);
}

export function getProvider(toolId?: string | null): IntegrationProvider {
  if (toolId && providers.has(toolId as IntegrationToolId)) {
    const p = providers.get(toolId as IntegrationToolId)!;
    if (p.isConfigured()) return p;
  }
  return mockProvider;
}

export function listAvailableIntegrations() {
  return INTEGRATION_CATALOG.map((item) => ({
    ...item,
    configured: providers.get(item.id)?.isConfigured() ?? false,
    available: item.id === "mock" || (providers.get(item.id)?.isConfigured() ?? false),
  }));
}

export function toolForActionType(actionType: AgentActionType): IntegrationToolId {
  switch (actionType) {
    case "SEND_EMAIL":
    case "DRAFT_EMAIL":
    case "FOLLOW_UP":
      return "gmail";
    case "DRAFT_MESSAGE":
      return "whatsapp_business";
    case "BOOK_APPOINTMENT":
    case "CREATE_CALENDAR_EVENT":
    case "SCHEDULE_REMINDER":
      return "google_calendar";
    case "GENERATE_PDF":
    case "GENERATE_REPORT":
      return "pdf_generator";
    case "RESEARCH_PROVIDERS":
    case "PREPARE_COMPARISON":
    case "CREATE_CONTACT_LIST":
      return "provider_search";
    default:
      return "mock";
  }
}
