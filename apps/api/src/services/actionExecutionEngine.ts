import type {
  ActionExecutionQueue,
  ActionExecutionStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import type { AppLocale } from "../lib/locale.js";
import { getProvider, toolForActionType } from "../integrations/registry.js";
import { detectActionForStep, isCommunicationAction } from "./actionDetector.js";
import { createChatCompletion } from "../lib/openai.js";

export function formatAgentAction(row: ActionExecutionQueue) {
  return {
    id: row.id,
    issueId: row.issueId,
    actionStepId: row.actionStepId,
    classification: row.classification,
    actionType: row.actionType,
    actionTitle: row.actionTitle,
    actionDescription: row.actionDescription,
    status: row.status,
    requiresApproval: row.requiresApproval,
    capabilities: asStringArray(row.capabilities),
    payload: row.payload as Record<string, unknown>,
    executionResult: row.executionResult as Record<string, unknown>,
    stateBlocked: row.stateBlocked,
    stateOverride: row.stateOverride,
    integrationTool: row.integrationTool,
    createdAt: row.createdAt,
    executedAt: row.executedAt,
    updatedAt: row.updatedAt,
  };
}

function localeHint(locale: AppLocale): string {
  if (locale === "he") return "Write the draft in Hebrew.";
  if (locale === "fr") return "Write the draft in French.";
  return "Write the draft in English.";
}

function shouldAutoExecuteOnApprove(actionType: string): boolean {
  return [
    "DRAFT_EMAIL",
    "DRAFT_MESSAGE",
    "GENERATE_REPORT",
    "GENERATE_PDF",
    "HYBRID_PREP",
    "RESEARCH_PROVIDERS",
    "PREPARE_COMPARISON",
    "CREATE_CONTACT_LIST",
    "BOOK_APPOINTMENT",
    "CREATE_CALENDAR_EVENT",
    "SCHEDULE_REMINDER",
  ].includes(actionType);
}

export function hasDraftArtifacts(
  payload: Record<string, unknown>,
  executionResult: Record<string, unknown>
): boolean {
  const artifacts = (executionResult.artifacts ?? {}) as Record<string, unknown>;
  return Boolean(
    artifacts.body ||
      artifacts.preview ||
      artifacts.subject ||
      payload.draftBody ||
      payload.body
  );
}

async function buildDraftPayload(
  row: ActionExecutionQueue,
  userId: string,
  locale: AppLocale
): Promise<Record<string, unknown>> {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  if (payload.aiDraftGenerated === true) return payload;

  const draftTypes = [
    "DRAFT_EMAIL",
    "SEND_EMAIL",
    "DRAFT_MESSAGE",
    "GENERATE_REPORT",
    "GENERATE_PDF",
    "HYBRID_PREP",
  ];
  if (!draftTypes.includes(row.actionType)) return payload;

  const issue = row.issueId
    ? await prisma.clarityIssue.findFirst({
        where: { id: row.issueId, userId },
        include: { outcome: true },
      })
    : null;
  const step = row.actionStepId
    ? await prisma.clarityStep.findFirst({ where: { id: row.actionStepId } })
    : null;

  const prompt = `Write a complete, ready-to-send draft for the user.
Return valid json: { "subject": "email subject if relevant", "body": "full draft text" }

Action title: ${row.actionTitle}
What Oracle offered: ${row.actionDescription}
Issue: ${issue?.title ?? "n/a"}
North Star: ${issue?.outcome?.northStarStatement ?? "n/a"}
Background: ${issue?.rawInput?.slice(0, 900) ?? "n/a"}
Current step: ${step?.title ?? "n/a"}
Step notes: ${step?.description ?? step?.prepareNotes ?? "n/a"}

Write a polished draft the user can copy — not a placeholder. ${localeHint(locale)}`;

  const ai = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  if (!ai.ok) return payload;

  const text = ai.completion.choices[0]?.message?.content ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return payload;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      subject?: string;
      body?: string;
    };
    const body = parsed.body?.trim();
    const subject = parsed.subject?.trim();
    if (!body && !subject) return payload;
    return {
      ...payload,
      draftSubject: subject ?? payload.draftSubject,
      draftBody: body ?? payload.draftBody,
      subject: subject ?? payload.subject,
      body: body ?? payload.body,
      aiDraftGenerated: true,
    };
  } catch {
    return payload;
  }
}

async function getLatestStateRisk(issueId: string, userId: string) {
  const snap = await prisma.stateSnapshot.findFirst({
    where: { userId, issueId },
    orderBy: { createdAt: "desc" },
  });
  if (!snap) return null;
  return {
    emotionalIntensity: snap.emotionalIntensity,
    factCertainty: snap.factCertainty,
    decisionRisk: snap.decisionRisk,
    detectedState: snap.detectedState,
    delayMajorDecisions: snap.delayMajorDecisions,
  };
}

export async function detectAndQueueForStep(
  issueId: string,
  stepId: string,
  userId: string,
  locale: AppLocale
) {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: { outcome: true },
  });
  const step = await prisma.clarityStep.findFirst({
    where: { id: stepId, issueId },
  });
  if (!issue || !step) return null;

  await prisma.actionExecutionQueue.updateMany({
    where: {
      issueId,
      actionStepId: stepId,
      status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED"] },
    },
    data: { status: "CANCELLED" },
  });

  const { action } = await detectActionForStep(
    step.title,
    step.description,
    {
      title: issue.title,
      rawInput: issue.rawInput,
      northStar: issue.outcome?.northStarStatement,
    },
    locale
  );

  if (action.classification === "HUMAN_ACTION" && action.actionType === "HUMAN_TASK") {
    const row = await prisma.actionExecutionQueue.create({
      data: {
        userId,
        issueId,
        actionStepId: stepId,
        classification: action.classification,
        actionType: action.actionType,
        actionTitle: action.actionTitle,
        actionDescription: action.actionDescription,
        status: "COMPLETED",
        requiresApproval: false,
        capabilities: action.capabilities,
        payload: action.payload as Prisma.InputJsonValue,
        executionResult: {
          note: "Human action — Oracle prepared guidance only.",
          humanRequired: true,
        },
        integrationTool: "mock",
        executedAt: new Date(),
      },
    });
    return formatAgentAction(row);
  }

  const stateRisk = await getLatestStateRisk(issueId, userId);
  const commAction = isCommunicationAction(action.actionType);
  const stateBlocked =
    commAction &&
    stateRisk != null &&
    stateRisk.emotionalIntensity > 7 &&
    stateRisk.factCertainty < 5;

  const effectiveType =
    stateBlocked && action.actionType === "SEND_EMAIL" ? "DRAFT_EMAIL" : action.actionType;

  const row = await prisma.actionExecutionQueue.create({
    data: {
      userId,
      issueId,
      actionStepId: stepId,
      classification: action.classification,
      actionType: effectiveType,
      actionTitle: action.actionTitle,
      actionDescription: stateBlocked
        ? `${action.actionDescription} State check: save draft only — reassess in 12–24 hours before sending.`
        : action.actionDescription,
      status: action.requiresApproval ? "AWAITING_APPROVAL" : "PENDING",
      requiresApproval: action.requiresApproval,
      capabilities: action.capabilities,
      payload: action.payload as Prisma.InputJsonValue,
      stateBlocked,
      integrationTool: action.integrationTool ?? toolForActionType(effectiveType),
    },
  });

  return formatAgentAction(row);
}

export async function listAgentActions(
  userId: string,
  filters?: { issueId?: string; status?: ActionExecutionStatus }
) {
  const rows = await prisma.actionExecutionQueue.findMany({
    where: {
      userId,
      ...(filters?.issueId ? { issueId: filters.issueId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(formatAgentAction);
}

export async function approveAgentAction(
  id: string,
  userId: string,
  overrideState = false,
  locale: AppLocale = "en"
) {
  const row = await prisma.actionExecutionQueue.findFirst({
    where: { id, userId },
  });
  if (!row) throw new Error("Action not found");
  if (!["AWAITING_APPROVAL", "PENDING"].includes(row.status)) {
    throw new Error("Action cannot be approved in current status");
  }

  await prisma.actionExecutionQueue.update({
    where: { id },
    data: {
      status: "APPROVED",
      stateOverride: overrideState,
    },
  });

  if (shouldAutoExecuteOnApprove(row.actionType)) {
    const result = await executeAgentAction(id, userId, overrideState, locale);
    return result.action;
  }

  const updated = await prisma.actionExecutionQueue.findFirst({ where: { id, userId } });
  return formatAgentAction(updated!);
}

export async function executeAgentAction(
  id: string,
  userId: string,
  forceSend = false,
  locale: AppLocale = "en"
) {
  let row = await prisma.actionExecutionQueue.findFirst({
    where: { id, userId },
  });
  if (!row) throw new Error("Action not found");
  if (!["APPROVED", "PENDING", "AWAITING_APPROVAL"].includes(row.status)) {
    throw new Error("Action cannot be executed in current status");
  }

  const comm = isCommunicationAction(row.actionType);
  let stateBlocked = row.stateBlocked;

  if (comm && row.issueId) {
    const risk = await getLatestStateRisk(row.issueId, userId);
    if (
      risk &&
      risk.emotionalIntensity > 7 &&
      risk.factCertainty < 5 &&
      !forceSend &&
      !row.stateOverride
    ) {
      stateBlocked = true;
    }
  }

  if (stateBlocked && comm && row.actionType === "SEND_EMAIL" && !forceSend) {
    await prisma.actionExecutionQueue.update({
      where: { id },
      data: {
        actionType: "DRAFT_EMAIL",
        stateBlocked: true,
        actionDescription: `${row.actionDescription} Blocked by state check — draft saved only.`,
      },
    });
    row = (await prisma.actionExecutionQueue.findFirst({ where: { id, userId } }))!;
  }

  await prisma.actionExecutionQueue.update({
    where: { id },
    data: { status: "EXECUTING" },
  });

  const enrichedPayload = await buildDraftPayload(row, userId, locale);
  let execRow = row;
  if (enrichedPayload.aiDraftGenerated) {
    execRow = await prisma.actionExecutionQueue.update({
      where: { id },
      data: { payload: enrichedPayload as Prisma.InputJsonValue },
    });
  }

  const provider = getProvider(execRow.integrationTool);
  const output = await provider.execute({
    actionType: execRow.actionType,
    title: execRow.actionTitle,
    description: execRow.actionDescription,
    payload: execRow.payload as Record<string, unknown>,
    userId,
  });

  const completed = await prisma.actionExecutionQueue.update({
    where: { id },
    data: {
      status: output.success ? "COMPLETED" : "FAILED",
      executionResult: {
        summary: output.summary,
        artifacts: output.artifacts,
        provider: provider.id,
      } as Prisma.InputJsonValue,
      executedAt: new Date(),
      payload: {
        ...(execRow.payload as object),
        ...output.artifacts,
      } as Prisma.InputJsonValue,
    },
  });

  if (output.followUpExpected) {
    await prisma.actionFollowThrough.create({
      data: {
        userId,
        queueId: id,
        eventType: "awaiting_response",
        eventSummary: output.followUpHint ?? "Monitoring for response",
        rawPayload: { artifacts: output.artifacts } as Prisma.InputJsonValue,
      },
    });
  }

  return { action: formatAgentAction(completed), blocked: false, stateMessage: null };
}

export async function cancelAgentAction(id: string, userId: string) {
  const row = await prisma.actionExecutionQueue.findFirst({ where: { id, userId } });
  if (!row) throw new Error("Action not found");
  const updated = await prisma.actionExecutionQueue.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  return formatAgentAction(updated);
}

export async function processFollowThroughEvent(
  queueId: string,
  userId: string,
  event: { eventType: string; eventSummary: string; rawPayload?: Record<string, unknown> },
  locale: AppLocale
) {
  const queue = await prisma.actionExecutionQueue.findFirst({
    where: { id: queueId, userId },
    include: { issue: { include: { outcome: true, steps: true } } },
  });
  if (!queue) throw new Error("Action not found");

  const ft = await prisma.actionFollowThrough.create({
    data: {
      userId,
      queueId,
      eventType: event.eventType,
      eventSummary: event.eventSummary,
      rawPayload: (event.rawPayload ?? {}) as Prisma.InputJsonValue,
    },
  });

  let nextActionHint = "Review the outcome and confirm the next move.";

  const prompt = `An Oracle agent action received a follow-through event. Suggest ONE next action. Return json:
{"nextActionHint": "string", "markStepComplete": boolean, "newPriority": "optional string"}

Action completed: ${queue.actionTitle}
Event: ${event.eventSummary}
Issue North Star: ${queue.issue?.outcome?.northStarStatement ?? "n/a"}`;

  const ai = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  type FollowPayload = { nextActionHint?: string; markStepComplete?: boolean };
  let markComplete = event.eventType === "response_received";

  if (ai.ok) {
    const text = ai.completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(text) as FollowPayload;
      if (parsed.nextActionHint) nextActionHint = parsed.nextActionHint;
      if (parsed.markStepComplete != null) markComplete = parsed.markStepComplete;
    } catch {
      /* use defaults */
    }
  }

  if (markComplete && queue.actionStepId && queue.issueId) {
    const step = await prisma.clarityStep.findFirst({
      where: { id: queue.actionStepId, status: "CURRENT" },
    });
    if (step) {
      await prisma.$transaction(async (tx) => {
        await tx.clarityStep.update({
          where: { id: step.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        const next = await tx.clarityStep.findFirst({
          where: { issueId: queue.issueId!, status: "LOCKED" },
          orderBy: { priorityOrder: "asc" },
        });
        if (next) {
          await tx.clarityStep.update({
            where: { id: next.id },
            data: { status: "CURRENT" },
          });
        }
      });
    }
  }

  await prisma.actionFollowThrough.update({
    where: { id: ft.id },
    data: { processed: true, processedAt: new Date(), nextActionHint },
  });

  return { followThrough: ft, nextActionHint, markComplete };
}

export async function queueActionsForCurrentStep(
  issueId: string,
  userId: string,
  locale: AppLocale
) {
  const step = await prisma.clarityStep.findFirst({
    where: { issueId, status: "CURRENT", issue: { userId } },
  });
  if (!step) return null;
  return detectAndQueueForStep(issueId, step.id, userId, locale);
}
