import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { HttpError } from "../lib/errors.js";
import { listAvailableIntegrations } from "../integrations/registry.js";
import {
  approveAgentAction,
  cancelAgentAction,
  detectAndQueueForStep,
  executeAgentAction,
  listAgentActions,
  processFollowThroughEvent,
} from "../services/actionExecutionEngine.js";

export const agentActionsRouter = Router();

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

agentActionsRouter.get("/integrations", asyncHandler(async (_req, res) => {
  res.json(listAvailableIntegrations());
}));

agentActionsRouter.get("/", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const issueId = req.query.issueId as string | undefined;
  const status = req.query.status as string | undefined;
  res.json(
    await listAgentActions(userId, {
      issueId,
      status: status as never,
    })
  );
}));

agentActionsRouter.post("/detect", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z
    .object({
      issueId: z.string(),
      stepId: z.string(),
    })
    .parse(req.body);

  const action = await detectAndQueueForStep(body.issueId, body.stepId, userId, locale);
  if (!action) throw new HttpError(404, "Issue or step not found");
  res.status(201).json(action);
}));

agentActionsRouter.post("/:id/approve", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const { overrideState } = z.object({ overrideState: z.boolean().optional() }).parse(req.body ?? {});
  try {
    res.json(await approveAgentAction(idParam(req.params.id), userId, overrideState ?? false));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Approve failed");
  }
}));

agentActionsRouter.post("/:id/execute", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const { forceSend } = z.object({ forceSend: z.boolean().optional() }).parse(req.body ?? {});
  try {
    res.json(await executeAgentAction(idParam(req.params.id), userId, forceSend ?? false));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Execute failed");
  }
}));

agentActionsRouter.post("/:id/cancel", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  try {
    res.json(await cancelAgentAction(idParam(req.params.id), userId));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Cancel failed");
  }
}));

agentActionsRouter.post("/:id/follow-through", asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z
    .object({
      eventType: z.string().min(1),
      eventSummary: z.string().min(1),
      rawPayload: z.record(z.unknown()).optional(),
    })
    .parse(req.body);

  try {
    res.json(
      await processFollowThroughEvent(
        idParam(req.params.id),
        userId,
        body,
        locale
      )
    );
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Follow-through failed");
  }
}));
