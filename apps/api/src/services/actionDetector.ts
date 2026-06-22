import type {
  ActionClassification,
  AgentActionType,
} from "@prisma/client";
import { createChatCompletion } from "../lib/openai.js";
import { localeAiInstruction, type AppLocale } from "../lib/locale.js";

export type DetectedAction = {
  classification: ActionClassification;
  actionType: AgentActionType;
  actionTitle: string;
  actionDescription: string;
  capabilities: string[];
  requiresApproval: boolean;
  payload: Record<string, unknown>;
  integrationTool?: string;
};

const VALID_CLASSIFICATIONS: ActionClassification[] = [
  "HUMAN_ACTION",
  "AGENT_ACTION",
  "HYBRID_ACTION",
];

const VALID_TYPES: AgentActionType[] = [
  "SEND_EMAIL",
  "DRAFT_EMAIL",
  "DRAFT_MESSAGE",
  "FOLLOW_UP",
  "BOOK_APPOINTMENT",
  "SCHEDULE_REMINDER",
  "CREATE_CALENDAR_EVENT",
  "GENERATE_REPORT",
  "RESEARCH_PROVIDERS",
  "PREPARE_COMPARISON",
  "CREATE_CONTACT_LIST",
  "GENERATE_PDF",
  "TRACK_RESPONSES",
  "HUMAN_TASK",
  "HYBRID_PREP",
];

function parseJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function localeHint(locale: AppLocale): string {
  return localeAiInstruction(locale);
}

function normalizeType(raw: string | undefined): AgentActionType {
  const u = (raw ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  if (VALID_TYPES.includes(u as AgentActionType)) return u as AgentActionType;
  if (/EMAIL|SEND|PACKAGE|AGENT|DEVELOP/i.test(raw ?? "")) return "DRAFT_EMAIL";
  if (/MESSAGE|WHATSAPP|TEXT|BOUNDARY|COMMUNICATE/i.test(raw ?? "")) return "DRAFT_MESSAGE";
  if (/VET|APPOINT|BOOK|CALL|SCHEDULE/i.test(raw ?? "")) return "BOOK_APPOINTMENT";
  if (/RESEARCH|FIND|PROVIDER|LIST|CONTACT/i.test(raw ?? "")) return "RESEARCH_PROVIDERS";
  if (/REPORT|PDF|SUMMARY|DOCUMENT/i.test(raw ?? "")) return "GENERATE_REPORT";
  if (/REMIND/i.test(raw ?? "")) return "SCHEDULE_REMINDER";
  if (/VISIT|MEET|INSPECT|FACE|PHYSICAL|ATTEND/i.test(raw ?? "")) return "HUMAN_TASK";
  return "HYBRID_PREP";
}

function normalizeClassification(raw: string | undefined): ActionClassification {
  const u = (raw ?? "").toUpperCase();
  if (VALID_CLASSIFICATIONS.includes(u as ActionClassification)) return u as ActionClassification;
  if (/HUMAN|VISIT|MEET|INSPECT/i.test(raw ?? "")) return "HUMAN_ACTION";
  if (/HYBRID|DRAFT|PREP/i.test(raw ?? "")) return "HYBRID_ACTION";
  return "AGENT_ACTION";
}

function offlineDetectAction(
  stepTitle: string,
  stepDescription: string | null | undefined,
  issueContext: string
): DetectedAction {
  const text = `${stepTitle} ${stepDescription ?? ""} ${issueContext}`.toLowerCase();

  if (/visit|inspect|attend meeting|face.to.face|in person|fly to|drive to/.test(text)) {
    return {
      classification: "HUMAN_ACTION",
      actionType: "HUMAN_TASK",
      actionTitle: stepTitle,
      actionDescription: "This step requires your physical presence — Oracle can prepare a checklist but cannot complete it.",
      capabilities: ["Prepare checklist", "Schedule reminder before visit"],
      requiresApproval: false,
      payload: { humanRequired: true },
    };
  }

  if (/email|send.*agent|development package|package to|contact agent|listing/.test(text)) {
    return {
      classification: "AGENT_ACTION",
      actionType: "DRAFT_EMAIL",
      actionTitle: `Prepare email: ${stepTitle}`,
      actionDescription: "Oracle can draft the email, attach a property summary, and queue it for your approval.",
      capabilities: ["Draft email", "Prepare summary", "Generate PDF", "Build contact list"],
      requiresApproval: true,
      payload: {
        draftSubject: `Re: ${stepTitle}`,
        draftBody: `Hi,\n\nFollowing up on ${stepTitle}.\n\n[Oracle will personalize this draft on approval.]\n\nBest regards`,
      },
      integrationTool: "gmail",
    };
  }

  if (/vet|appointment|book|call|schedule/.test(text)) {
    return {
      classification: "AGENT_ACTION",
      actionType: "BOOK_APPOINTMENT",
      actionTitle: `Book appointment: ${stepTitle}`,
      actionDescription: "Oracle can find providers, draft an appointment request, and queue it for approval.",
      capabilities: ["Research providers", "Draft appointment request", "Schedule reminder"],
      requiresApproval: true,
      payload: { appointmentFor: stepTitle },
      integrationTool: "google_calendar",
    };
  }

  if (/message|boundary|communicate|rachel|partner|relationship|text|whatsapp/.test(text)) {
    return {
      classification: "HYBRID_ACTION",
      actionType: "DRAFT_MESSAGE",
      actionTitle: `Draft message: ${stepTitle}`,
      actionDescription: "Oracle will draft the message and save it — you send when ready (especially if state risk is high).",
      capabilities: ["Draft message", "Save draft", "Delay send if triggered"],
      requiresApproval: true,
      payload: {
        channel: "whatsapp",
        draftBody: `[Draft — review before sending]\n\n${stepDescription ?? stepTitle}`,
      },
      integrationTool: "whatsapp_business",
    };
  }

  if (/research|find|compare|provider|list/.test(text)) {
    return {
      classification: "AGENT_ACTION",
      actionType: "RESEARCH_PROVIDERS",
      actionTitle: `Research: ${stepTitle}`,
      actionDescription: "Oracle can compile providers and a comparison table for your review.",
      capabilities: ["Research providers", "Prepare comparison table", "Create contact list"],
      requiresApproval: true,
      payload: {},
      integrationTool: "provider_search",
    };
  }

  return {
    classification: "HYBRID_ACTION",
    actionType: "HYBRID_PREP",
    actionTitle: stepTitle,
    actionDescription: stepDescription ?? "Oracle can prepare materials — you complete the final step.",
    capabilities: ["Prepare summary", "Schedule reminder"],
    requiresApproval: true,
    payload: { prepNotes: stepDescription },
  };
}

export async function detectActionForStep(
  stepTitle: string,
  stepDescription: string | null | undefined,
  issueContext: {
    rawInput: string;
    northStar?: string | null;
    title: string;
  },
  locale: AppLocale
): Promise<{ action: DetectedAction; source: "openai" | "offline" }> {
  const prompt = `You are Oracle's action classifier. Ask "Can Oracle do this?" — not "What should the user do?"

Classify this clarity step:
{
  "classification": "HUMAN_ACTION" | "AGENT_ACTION" | "HYBRID_ACTION",
  "actionType": one of ${VALID_TYPES.join(" | ")},
  "actionTitle": "short title",
  "actionDescription": "what Oracle will do for the user",
  "capabilities": ["Oracle Can Do items — e.g. Draft email, Generate PDF"],
  "requiresApproval": boolean,
  "payload": {
    "draftSubject": "optional",
    "draftBody": "optional draft text",
    "channel": "optional whatsapp|email|sms",
    "to": "optional recipient hint"
  },
  "integrationTool": "gmail|google_calendar|whatsapp_business|provider_search|mock"
}

Issue: ${issueContext.title}
North Star: ${issueContext.northStar ?? "n/a"}
Context: ${issueContext.rawInput.slice(0, 500)}

Step title: ${stepTitle}
Step description: ${stepDescription ?? "n/a"}

HUMAN_ACTION = physical presence required.
AGENT_ACTION = software can complete (with approval).
HYBRID_ACTION = Oracle prepares, user finalizes (send, sign, visit).`;

  const result = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify actions for Oracle Agent execution. Return json. ${localeHint(locale)}`,
      },
      { role: "user", content: prompt },
    ],
  });

  if (!result.ok) {
    return {
      action: offlineDetectAction(stepTitle, stepDescription, issueContext.rawInput),
      source: "offline",
    };
  }

  const text = result.completion.choices[0]?.message?.content ?? "";
  const data = parseJson<Partial<DetectedAction> & { classification?: string; actionType?: string }>(text);

  if (!data?.actionTitle) {
    return {
      action: offlineDetectAction(stepTitle, stepDescription, issueContext.rawInput),
      source: "offline",
    };
  }

  return {
    action: {
      classification: normalizeClassification(data.classification),
      actionType: normalizeType(data.actionType),
      actionTitle: data.actionTitle,
      actionDescription: data.actionDescription ?? data.actionTitle,
      capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
      requiresApproval: data.requiresApproval ?? true,
      payload: (data.payload as Record<string, unknown>) ?? {},
      integrationTool: data.integrationTool,
    },
    source: "openai",
  };
}

export function isCommunicationAction(type: AgentActionType): boolean {
  return ["SEND_EMAIL", "DRAFT_EMAIL", "DRAFT_MESSAGE", "FOLLOW_UP"].includes(type);
}
