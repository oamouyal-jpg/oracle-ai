/** Supported integration tools — wired via registry when credentials exist. */
export type IntegrationCategory =
  | "communication"
  | "calendar"
  | "documents"
  | "research";

export type IntegrationToolId =
  | "gmail"
  | "outlook"
  | "whatsapp_business"
  | "sms"
  | "telegram"
  | "google_calendar"
  | "outlook_calendar"
  | "pdf_generator"
  | "report_builder"
  | "spreadsheet"
  | "business_search"
  | "provider_search"
  | "property_search"
  | "mock";

export type AgentExecutionInput = {
  actionType: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  userId: string;
};

export type AgentExecutionOutput = {
  success: boolean;
  summary: string;
  artifacts: Record<string, unknown>;
  followUpExpected?: boolean;
  followUpHint?: string;
};

export interface IntegrationProvider {
  id: IntegrationToolId;
  category: IntegrationCategory;
  label: string;
  isConfigured: () => boolean;
  execute: (input: AgentExecutionInput) => Promise<AgentExecutionOutput>;
}

export const INTEGRATION_CATALOG: {
  id: IntegrationToolId;
  category: IntegrationCategory;
  label: string;
}[] = [
  { id: "gmail", category: "communication", label: "Gmail" },
  { id: "outlook", category: "communication", label: "Outlook" },
  { id: "whatsapp_business", category: "communication", label: "WhatsApp Business" },
  { id: "sms", category: "communication", label: "SMS" },
  { id: "telegram", category: "communication", label: "Telegram" },
  { id: "google_calendar", category: "calendar", label: "Google Calendar" },
  { id: "outlook_calendar", category: "calendar", label: "Outlook Calendar" },
  { id: "pdf_generator", category: "documents", label: "PDF generation" },
  { id: "report_builder", category: "documents", label: "Reports" },
  { id: "spreadsheet", category: "documents", label: "Spreadsheets" },
  { id: "business_search", category: "research", label: "Business search" },
  { id: "provider_search", category: "research", label: "Provider search" },
  { id: "property_search", category: "research", label: "Property search" },
];
