import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { HttpError } from "../lib/errors.js";
import {
  completeCurrentStep,
  formatIssueDetail,
  loadIssueDetail,
  processCheckIn,
  promoteIssueToMission,
  runIntakeAnalysis,
  skipCurrentStep,
  submitClarifyingAnswer,
  retryClarityPlan,
  requestClarityAdvice,
} from "../services/clarityEngine.js";
import { createWeekPlan } from "../services/weekPlanEngine.js";
import { runStateDetection } from "../services/stateDetectionEngine.js";
import {
  archiveStaleCompletedIssues,
  deleteClarityIssueWithCleanup,
} from "../services/clarityLifecycle.js";
import { clarityTaskProgress } from "../services/clarityTaskSync.js";

export const clarityRouter = Router();

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

clarityRouter.get("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const status = req.query.status as string | undefined;
  await archiveStaleCompletedIssues(userId);
  const issues = await prisma.clarityIssue.findMany({
    where: {
      userId,
      ...(status ? { status: status as never } : { status: { not: "ARCHIVED" } }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      outcome: { select: { northStarStatement: true } },
      steps: {
        select: { status: true, linkedTaskId: true, title: true },
        orderBy: { priorityOrder: "asc" },
      },
      _count: { select: { steps: true } },
    },
  });

  res.json(
    issues.map((i) => {
      const progress = clarityTaskProgress(i.steps);
      const currentStep = i.steps.find((s) => s.status === "CURRENT");
      return {
      id: i.id,
      title: i.title,
      mode: i.mode,
      status: i.status,
      aiSummary: i.aiSummary,
      northStar: i.outcome?.northStarStatement,
      currentStepTitle: currentStep?.title ?? null,
      stepCount: i._count.steps,
      taskProgress: progress,
      promotedMissionId: i.promotedMissionId,
      updatedAt: i.updatedAt,
      createdAt: i.createdAt,
    };
    })
  );
}));

clarityRouter.post("/week", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const schema = z.object({
    rawInput: z.string().min(12),
  });
  const body = schema.parse(req.body);

  const { source, issueId } = await createWeekPlan(userId, body.rawInput.trim(), locale);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.status(201).json({ ...detail, aiSource: source });
}));

clarityRouter.post("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const schema = z.object({
    rawInput: z.string().min(12),
    emotionalIntensity: z.number().min(1).max(10).optional(),
    urgency: z.number().min(1).max(10).optional(),
    importance: z.number().min(1).max(10).optional(),
  });
  const body = schema.parse(req.body);

  const issue = await prisma.clarityIssue.create({
    data: {
      userId,
      title: "New clarity issue",
      rawInput: body.rawInput.trim(),
      emotionalIntensity: body.emotionalIntensity,
      urgency: body.urgency,
      importance: body.importance,
      status: "INTAKE",
    },
  });

  await prisma.clarityMessage.create({
    data: {
      userId,
      issueId: issue.id,
      role: "USER",
      kind: "INTAKE",
      content: body.rawInput.trim(),
    },
  });

  const { source } = await runIntakeAnalysis(issue.id, userId, locale);
  const detail = formatIssueDetail(await loadIssueDetail(issue.id, userId));
  res.status(201).json({ ...detail, aiSource: source });
}));

clarityRouter.get("/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  await archiveStaleCompletedIssues(userId);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  if (!detail) throw new HttpError(404, "Issue not found");
  res.json(detail);
}));

clarityRouter.post("/:id/clarify", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const issueId = idParam(req.params.id);
  const { answer } = z.object({ answer: z.string().min(1) }).parse(req.body);
  const result = await submitClarifyingAnswer(issueId, userId, answer, locale);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json({ ...detail, ...result });
}));

clarityRouter.post("/:id/retry-plan", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const issueId = idParam(req.params.id);
  const { source } = await retryClarityPlan(issueId, userId, locale);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json({ ...detail, aiSource: source });
}));

clarityRouter.post("/:id/steps/:stepId/complete", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  const stepId = idParam(req.params.stepId);
  await completeCurrentStep(issueId, stepId, userId);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json(detail);
}));

clarityRouter.post("/:id/steps/:stepId/skip", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  const stepId = idParam(req.params.stepId);
  await skipCurrentStep(issueId, stepId, userId);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json(detail);
}));

clarityRouter.post("/:id/check-in", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const issueId = idParam(req.params.id);
  const { rawText } = z.object({ rawText: z.string().min(3) }).parse(req.body);

  const stateResult = await runStateDetection(userId, rawText.trim(), locale, { issueId });
  const snap = stateResult.snapshot;

  const { source } = await processCheckIn(issueId, userId, rawText, locale, {
    detectedState: snap.detectedState,
    emotionalIntensity: snap.emotionalIntensity,
    factCertainty: snap.factCertainty,
    decisionRisk: snap.decisionRisk,
    delayMajorDecisions: snap.delayMajorDecisions,
    suggestedAction: snap.suggestedAction,
    aiReasoningSummary: snap.aiReasoningSummary,
  });

  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json({ ...detail, aiSource: source, stateDetection: stateResult });
}));

clarityRouter.post("/:id/advice", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const issueId = idParam(req.params.id);
  const body = z
    .object({
      question: z.string().min(3),
      stepId: z.string().optional(),
      taskId: z.string().optional(),
      missionId: z.string().optional(),
    })
    .parse(req.body);

  const result = await requestClarityAdvice(
    issueId,
    userId,
    body.question,
    locale,
    {
      stepId: body.stepId,
      taskId: body.taskId,
      missionId: body.missionId,
    }
  );
  res.json(result);
}));

clarityRouter.post("/:id/promote", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  const missionId = await promoteIssueToMission(issueId, userId);
  const detail = formatIssueDetail(await loadIssueDetail(issueId, userId));
  res.json({ ...detail, missionId });
}));

clarityRouter.patch("/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  const schema = z.object({
    status: z.enum(["PAUSED", "ARCHIVED", "ACTIVE"]).optional(),
    title: z.string().min(1).optional(),
  });
  const body = schema.parse(req.body);
  const existing = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
  });
  if (!existing) throw new HttpError(404, "Issue not found");

  await prisma.clarityIssue.update({
    where: { id: existing.id },
    data: body,
  });
  res.json(formatIssueDetail(await loadIssueDetail(existing.id, userId)));
}));

clarityRouter.delete("/:id", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = idParam(req.params.id);
  try {
    await deleteClarityIssueWithCleanup(issueId, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    if (message === "Issue not found") throw new HttpError(404, message);
    throw err;
  }
  res.status(204).send();
}));
