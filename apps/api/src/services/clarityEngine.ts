import { prisma } from "../lib/prisma.js";
import { createChatCompletion } from "../lib/openai.js";
import { asStringArray } from "../lib/arrays.js";
import type { AppLocale } from "../lib/locale.js";
import type { ClarityConstraintType } from "@prisma/client";
import { queueActionsForCurrentStep, formatAgentAction } from "./actionExecutionEngine.js";

const CLARITY_SYSTEM = `You are Oracle Clarity — a calm, direct life operator. You help overwhelmed people turn messy situations into one clear desired outcome and a small sequence of actions.

Rules:
- Never dump long task lists. Prefer 3–7 high-leverage steps total.
- Always separate: problem, emotion, constraint, desired outcome, and action.
- Prioritize by desired outcome, not panic urgency alone.
- If the user is overwhelmed, reduce complexity.
- Respond ONLY with valid JSON matching the requested schema. No markdown fences.`;

export type IntakeAnalysis = {
  title: string;
  aiSummary: string;
  needsClarification: boolean;
  clarifyingQuestions: string[];
};

export type PlanPayload = {
  outcome: {
    northStarStatement: string;
    desiredLifeState?: string;
    primaryGoal?: string;
    secondaryGoals?: string[];
    successDefinition?: string;
    avoidDefinition?: string;
  };
  constraints: { type: string; description: string; severity: number }[];
  steps: {
    title: string;
    description?: string;
    whyThisNow?: string;
    prepareNotes?: string;
    difficulty?: number;
    expectedOutcome?: string;
    completionCriteria?: string;
  }[];
};

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
  if (locale === "he") return "Write all user-facing strings in Hebrew.";
  if (locale === "fr") return "Write all user-facing strings in French.";
  return "Write all user-facing strings in English.";
}

function offlineIntake(rawInput: string): IntakeAnalysis {
  const short = rawInput.slice(0, 48).trim() || "Life clarity session";
  const title = short.length > 42 ? `${short.slice(0, 42)}…` : short;
  const wordCount = rawInput.split(/\s+/).length;
  const needsClarification = wordCount < 25;
  return {
    title,
    aiSummary:
      "You're carrying several threads at once — property, relationship, location, and money may be tangled. Oracle will help you name what 'solved' actually looks like, then pick one move.",
    needsClarification,
    clarifyingQuestions: needsClarification
      ? [
          "What outcome would make this feel genuinely solved — not just quieter?",
          "What are you trying to protect, and what are you trying to avoid?",
          "If nothing changed for six months, what would that cost you emotionally or financially?",
        ].slice(0, 3)
      : [],
  };
}

function offlinePlan(rawInput: string, answers: string[]): PlanPayload {
  const context = [rawInput, ...answers].join("\n");
  const israel = /israel|rachel|airlie|house|property|sell/i.test(context);
  return {
    outcome: {
      northStarStatement: israel
        ? "Live peacefully in Israel with Rachel while the Airlie property becomes a quiet, managed asset — not a constant drain on your attention."
        : "Move from reactive chaos to a clear, peaceful life direction with one concrete lever at a time.",
      desiredLifeState: israel
        ? "Grounded daily life in Israel, relationship present, property handled without background noise."
        : "Calm focus on what matters most, with noise separated from priorities.",
      primaryGoal: israel
        ? "Remove ongoing noise and uncertainty from the property situation."
        : "Name the real desired outcome and stop juggling everything at once.",
      secondaryGoals: israel
        ? ["Protect the relationship with Rachel", "Preserve property value where possible"]
        : ["Reduce emotional load", "Create financial clarity"],
      successDefinition: israel
        ? "You know exactly what must happen with the property and you're not carrying it mentally every day."
        : "You can describe 'done' in one sentence and your next action matches it.",
      avoidDefinition: "Endless debate, shame spirals, or urgent-but-unimportant busywork.",
    },
    constraints: [
      { type: "EMOTIONAL", description: "Fear of making the wrong move under pressure.", severity: 7 },
      { type: "FINANCIAL", description: "Property and relocation costs affect timing.", severity: 8 },
      ...(israel
        ? [{ type: "LOCATION", description: "Managing Airlie from Israel adds distance and compliance risk.", severity: 8 }]
        : []),
    ],
    steps: israel
      ? [
          {
            title: "Get a written compliance / sale-readiness picture for Airlie",
            description:
              "Book a compliance inspection or planner consult so you know what must be fixed, approved, or removed.",
            whyThisNow:
              "You can't choose sale vs. hold vs. operator until you know the regulatory and cost baseline.",
            prepareNotes: "Property address, recent correspondence, any council notices.",
            difficulty: 6,
            expectedOutcome: "A written summary of required actions and cost range.",
            completionCriteria: "You have a document or email listing fixes, approvals, and ballpark costs.",
          },
          {
            title: "Decide: sell, rent, or operator — with Rachel",
            description: "One honest conversation framed around your North Star, not fear.",
            whyThisNow: "Strategy follows facts from step one.",
            difficulty: 5,
            completionCriteria: "You agree on a primary path for the property for the next 90 days.",
          },
          {
            title: "Assign one owner for property follow-through",
            description: "Who makes calls, who signs, who tracks — so it doesn't live in both your heads.",
            whyThisNow: "Shared clarity prevents the house from pulling you back mentally.",
            difficulty: 4,
            completionCriteria: "Named owner + next external appointment scheduled.",
          },
        ]
      : [
          {
            title: "Write your 'solved' sentence in one line",
            description: "Finish: 'This problem is solved when ___.'",
            whyThisNow: "Everything else orders itself once the outcome is explicit.",
            difficulty: 3,
            completionCriteria: "One sentence you and Oracle both accept as the North Star.",
          },
          {
            title: "List the three noisiest worries — circle the one that blocks everything",
            description: "Separate noise from the constraint that actually gates progress.",
            whyThisNow: "Overwhelm often comes from treating every worry as equally urgent.",
            difficulty: 4,
            completionCriteria: "One circled blocker with a short reason why it's first.",
          },
          {
            title: "Take the smallest external action on that blocker",
            description: "One email, call, or booking — not planning, doing.",
            whyThisNow: "Motion creates clarity; more thinking rarely does.",
            difficulty: 5,
            completionCriteria: "You sent the message or booked the appointment.",
          },
        ],
  };
}

async function callClarityJson<T>(
  userPrompt: string,
  locale: AppLocale
): Promise<{ data: T | null; source: "openai" | "offline" }> {
  const result = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${CLARITY_SYSTEM}\n${localeHint(locale)}` },
      { role: "user", content: userPrompt },
    ],
  });

  if (!result.ok) return { data: null, source: "offline" };

  const text = result.completion.choices[0]?.message?.content ?? "";
  const data = parseJson<T>(text);
  return { data, source: "openai" };
}

export async function runIntakeAnalysis(
  issueId: string,
  userId: string,
  locale: AppLocale
): Promise<{ source: "openai" | "offline" }> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
  });
  if (!issue) throw new Error("Issue not found");

  const prompt = `Analyze this life issue brain dump. Return JSON:
{
  "title": "short title max 60 chars",
  "aiSummary": "2-3 calm sentences summarizing situation",
  "needsClarification": boolean,
  "clarifyingQuestions": ["max 3 questions, only if needsClarification"]
}

Brain dump:
${issue.rawInput}`;

  let analysis: IntakeAnalysis;
  const { data, source } = await callClarityJson<IntakeAnalysis>(prompt, locale);
  if (data?.title && data.aiSummary) {
    analysis = {
      title: data.title,
      aiSummary: data.aiSummary,
      needsClarification: Boolean(data.needsClarification),
      clarifyingQuestions: (data.clarifyingQuestions ?? []).slice(0, 3),
    };
  } else {
    analysis = offlineIntake(issue.rawInput);
  }

  const questions = analysis.needsClarification ? analysis.clarifyingQuestions : [];

  await prisma.$transaction(async (tx) => {
    await tx.clarityIssue.update({
      where: { id: issueId },
      data: {
        title: analysis.title,
        aiSummary: analysis.aiSummary,
        pendingQuestions: questions,
        clarifyingAnswers: [],
        status: questions.length > 0 ? "CLARIFYING" : "INTAKE",
      },
    });

    if (questions.length > 0) {
      await tx.clarityMessage.create({
        data: {
          userId,
          issueId,
          role: "ASSISTANT",
          kind: "CLARIFYING_QUESTION",
          content: questions[0]!,
        },
      });
    }
  });

  if (questions.length === 0) {
    await synthesizeAndActivatePlan(issueId, userId, locale);
  }

  return { source: questions.length === 0 ? source : source };
}

export async function submitClarifyingAnswer(
  issueId: string,
  userId: string,
  answer: string,
  locale: AppLocale
): Promise<{ done: boolean; source: "openai" | "offline" }> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId, status: "CLARIFYING" },
  });
  if (!issue) throw new Error("Issue not in clarifying state");

  const pending = asStringArray(issue.pendingQuestions);
  const answers = asStringArray(issue.clarifyingAnswers);
  if (pending.length === 0) throw new Error("No pending questions");

  const currentQuestion = pending[0]!;
  const newAnswers = [...answers, answer.trim()];
  const remaining = pending.slice(1);

  await prisma.clarityMessage.create({
    data: {
      userId,
      issueId,
      role: "USER",
      kind: "CLARIFYING_QUESTION",
      content: answer.trim(),
    },
  });

  if (remaining.length > 0) {
    await prisma.$transaction([
      prisma.clarityIssue.update({
        where: { id: issueId },
        data: {
          clarifyingAnswers: newAnswers,
          pendingQuestions: remaining,
        },
      }),
      prisma.clarityMessage.create({
        data: {
          userId,
          issueId,
          role: "ASSISTANT",
          kind: "CLARIFYING_QUESTION",
          content: remaining[0]!,
        },
      }),
    ]);
    return { done: false, source: "offline" };
  }

  await prisma.clarityIssue.update({
    where: { id: issueId },
    data: {
      clarifyingAnswers: newAnswers,
      pendingQuestions: [],
    },
  });

  const src = await synthesizeAndActivatePlan(issueId, userId, locale);
  return { done: true, source: src };
}

function mapConstraintType(raw: string): ClarityConstraintType {
  const u = raw.toUpperCase();
  const allowed = [
    "FINANCIAL",
    "EMOTIONAL",
    "LEGAL",
    "TIME",
    "RELATIONSHIP",
    "HEALTH",
    "LOCATION",
    "OTHER",
  ] as const;
  return (allowed.includes(u as (typeof allowed)[number]) ? u : "OTHER") as ClarityConstraintType;
}

export async function synthesizeAndActivatePlan(
  issueId: string,
  userId: string,
  locale: AppLocale
): Promise<"openai" | "offline"> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
  });
  if (!issue) throw new Error("Issue not found");

  const answers = asStringArray(issue.clarifyingAnswers);
  const qaBlock =
    answers.length > 0
      ? `\nClarifying answers:\n${answers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "";

  const prompt = `Create a clarity plan. Return JSON:
{
  "outcome": {
    "northStarStatement": "one clear sentence",
    "desiredLifeState": "string",
    "primaryGoal": "string",
    "secondaryGoals": ["..."],
    "successDefinition": "string",
    "avoidDefinition": "string"
  },
  "constraints": [{ "type": "FINANCIAL|EMOTIONAL|LEGAL|TIME|RELATIONSHIP|HEALTH|LOCATION|OTHER", "description": "string", "severity": 1-10 }],
  "steps": [{
    "title": "string",
    "description": "string",
    "whyThisNow": "string",
    "prepareNotes": "string",
    "difficulty": 1-10,
    "expectedOutcome": "string",
    "completionCriteria": "string"
  }]
}
Max 7 steps. Order by leverage toward the North Star.

Original issue:
${issue.rawInput}${qaBlock}`;

  let plan: PlanPayload;
  const { data, source } = await callClarityJson<PlanPayload>(prompt, locale);
  if (data?.outcome?.northStarStatement && Array.isArray(data.steps) && data.steps.length > 0) {
    plan = data;
  } else {
    plan = offlinePlan(issue.rawInput, answers);
  }

  await prisma.$transaction(async (tx) => {
    await tx.clarityOutcome.deleteMany({ where: { issueId } });
    await tx.clarityConstraint.deleteMany({ where: { issueId } });
    await tx.clarityStep.deleteMany({ where: { issueId } });

    await tx.clarityOutcome.create({
      data: {
        issueId,
        northStarStatement: plan.outcome.northStarStatement,
        desiredLifeState: plan.outcome.desiredLifeState,
        primaryGoal: plan.outcome.primaryGoal,
        secondaryGoals: plan.outcome.secondaryGoals ?? [],
        successDefinition: plan.outcome.successDefinition,
        avoidDefinition: plan.outcome.avoidDefinition,
      },
    });

    for (const c of plan.constraints ?? []) {
      await tx.clarityConstraint.create({
        data: {
          issueId,
          type: mapConstraintType(c.type),
          description: c.description,
          severity: Math.min(10, Math.max(1, c.severity ?? 5)),
        },
      });
    }

    for (let i = 0; i < plan.steps.length; i += 1) {
      const s = plan.steps[i]!;
      await tx.clarityStep.create({
        data: {
          issueId,
          title: s.title,
          description: s.description,
          whyThisNow: s.whyThisNow,
          prepareNotes: s.prepareNotes,
          priorityOrder: i,
          status: i === 0 ? "CURRENT" : "LOCKED",
          difficulty: Math.min(10, Math.max(1, s.difficulty ?? 5)),
          expectedOutcome: s.expectedOutcome,
          completionCriteria: s.completionCriteria,
        },
      });
    }

    await tx.clarityIssue.update({
      where: { id: issueId },
      data: { status: "ACTIVE" },
    });

    await tx.clarityMessage.create({
      data: {
        userId,
        issueId,
        role: "ASSISTANT",
        kind: "ANALYSIS",
        content: `North Star set. Your first move is ready — focus on that only until it's done.`,
      },
    });
  });

  await queueActionsForCurrentStep(issueId, userId, locale).catch((err) => {
    console.warn("[Oracle] Agent action queue skipped:", err instanceof Error ? err.message : err);
  });
  return source;
}

export async function completeCurrentStep(
  issueId: string,
  stepId: string,
  userId: string
): Promise<void> {
  const step = await prisma.clarityStep.findFirst({
    where: { id: stepId, issueId, issue: { userId } },
  });
  if (!step) throw new Error("Step not found");
  if (step.status !== "CURRENT") throw new Error("Only the current step can be completed");

  await prisma.$transaction(async (tx) => {
    await tx.clarityStep.update({
      where: { id: stepId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const next = await tx.clarityStep.findFirst({
      where: { issueId, status: "LOCKED" },
      orderBy: { priorityOrder: "asc" },
    });

    if (next) {
      await tx.clarityStep.update({
        where: { id: next.id },
        data: { status: "CURRENT" },
      });
      await tx.clarityIssue.update({
        where: { id: issueId },
        data: { status: "ACTIVE" },
      });
    } else {
      await tx.clarityIssue.update({
        where: { id: issueId },
        data: { status: "COMPLETED" },
      });
    }
  });

  await queueActionsForCurrentStep(issueId, userId, "en").catch((err) => {
    console.warn("[Oracle] Agent action queue skipped:", err instanceof Error ? err.message : err);
  });
}

export async function skipCurrentStep(
  issueId: string,
  stepId: string,
  userId: string
): Promise<void> {
  const step = await prisma.clarityStep.findFirst({
    where: { id: stepId, issueId, issue: { userId } },
  });
  if (!step) throw new Error("Step not found");
  if (step.status !== "CURRENT") throw new Error("Only the current step can be skipped");

  await prisma.$transaction(async (tx) => {
    await tx.clarityStep.update({
      where: { id: stepId },
      data: { status: "SKIPPED" },
    });

    const next = await tx.clarityStep.findFirst({
      where: { issueId, status: "LOCKED" },
      orderBy: { priorityOrder: "asc" },
    });

    if (next) {
      await tx.clarityStep.update({
        where: { id: next.id },
        data: { status: "CURRENT" },
      });
    } else {
      await tx.clarityIssue.update({
        where: { id: issueId },
        data: { status: "COMPLETED" },
      });
    }
  });

  await queueActionsForCurrentStep(issueId, userId, "en").catch((err) => {
    console.warn("[Oracle] Agent action queue skipped:", err instanceof Error ? err.message : err);
  });
}

export async function processCheckIn(
  issueId: string,
  userId: string,
  rawText: string,
  locale: AppLocale,
  stateContext?: {
    detectedState: string;
    emotionalIntensity: number;
    factCertainty: number;
    decisionRisk: number;
    delayMajorDecisions: boolean;
    suggestedAction: string;
    aiReasoningSummary?: string | null;
  }
): Promise<{ source: "openai" | "offline" }> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: { outcome: true, steps: { where: { status: "CURRENT" } } },
  });
  if (!issue) throw new Error("Issue not found");

  const currentStep = issue.steps[0];
  const highRisk = stateContext?.delayMajorDecisions || (stateContext?.decisionRisk ?? 0) >= 7;

  const stateBlock = stateContext
    ? `
State detection (run BEFORE planning):
- Detected state: ${stateContext.detectedState}
- Emotional intensity: ${stateContext.emotionalIntensity}/10
- Fact certainty: ${stateContext.factCertainty}/10
- Decision risk: ${stateContext.decisionRisk}/10
- Delay major decisions: ${stateContext.delayMajorDecisions ? "YES" : "no"}
${stateContext.aiReasoningSummary ? `- Oracle mirror: ${stateContext.aiReasoningSummary}` : ""}
${highRisk ? "IMPORTANT: User is in a high-risk triggered state. Do NOT suggest aggressive, permanent, or confrontational actions. Suggest ONE stabilizing safe action only." : ""}`
    : "";

  const prompt = `Daily check-in for a clarity issue. Return JSON:
{
  "aiSummary": "2-3 sentences",
  "completedActions": ["..."],
  "newRisks": ["..."],
  "suggestedNextAction": "one sentence — stabilizing if user is triggered",
  "priorityShift": "optional — what changed in priorities"
}
${stateBlock}

North Star: ${issue.outcome?.northStarStatement ?? "n/a"}
Current step: ${currentStep?.title ?? "none"}

User check-in:
${rawText}`;

  type CheckInResult = {
    aiSummary: string;
    completedActions?: string[];
    newRisks?: string[];
    suggestedNextAction?: string;
    priorityShift?: string;
  };

  let parsed: CheckInResult;
  const { data, source } = await callClarityJson<CheckInResult>(prompt, locale);
  if (data?.aiSummary) {
    parsed = data;
  } else {
    parsed = {
      aiSummary: stateContext?.aiReasoningSummary ??
        "You showed up to reflect — that matters. Oracle captured what you wrote and will keep the next move small.",
      completedActions: [],
      newRisks: stateContext?.delayMajorDecisions ? ["Acting on major decisions while triggered"] : [],
      suggestedNextAction: highRisk && stateContext?.suggestedAction
        ? stateContext.suggestedAction
        : currentStep
          ? `Continue: ${currentStep.title}`
          : "Review your North Star and pick one small external action.",
      priorityShift: undefined,
    };
  }

  if (highRisk && stateContext?.suggestedAction) {
    parsed.suggestedNextAction = stateContext.suggestedAction;
    if (stateContext.aiReasoningSummary) {
      parsed.aiSummary = stateContext.aiReasoningSummary;
    }
  }

  await prisma.$transaction([
    prisma.clarityCheckIn.create({
      data: {
        userId,
        issueId,
        rawText,
        aiSummary: parsed.aiSummary,
        completedActions: parsed.completedActions ?? [],
        newRisks: parsed.newRisks ?? [],
        suggestedNextAction: parsed.suggestedNextAction,
        priorityShift: parsed.priorityShift,
      },
    }),
    prisma.clarityMessage.create({
      data: {
        userId,
        issueId,
        role: "USER",
        kind: "CHECKIN",
        content: rawText,
      },
    }),
    prisma.clarityMessage.create({
      data: {
        userId,
        issueId,
        role: "ASSISTANT",
        kind: "COACHING",
        content: parsed.suggestedNextAction ?? parsed.aiSummary,
      },
    }),
  ]);

  return { source };
}

export async function promoteIssueToMission(issueId: string, userId: string): Promise<string> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: { outcome: true, steps: true },
  });
  if (!issue) throw new Error("Issue not found");
  if (issue.promotedMissionId) return issue.promotedMissionId;

  const pendingSteps = issue.steps.filter((s) => s.status === "LOCKED" || s.status === "CURRENT");
  const nextActions = pendingSteps.slice(0, 5).map((s) => s.title);

  const mission = await prisma.mission.create({
    data: {
      userId,
      title: issue.title,
      purpose: issue.outcome?.primaryGoal ?? issue.aiSummary ?? undefined,
      whyItMatters: issue.outcome?.avoidDefinition ?? undefined,
      desiredOutcome: issue.outcome?.northStarStatement ?? undefined,
      nextActions,
      status: "ACTIVE",
      missionType: "GENERAL",
    },
  });

  await prisma.clarityIssue.update({
    where: { id: issueId },
    data: {
      promotedMissionId: mission.id,
      status: issue.status === "COMPLETED" ? "COMPLETED" : "PAUSED",
    },
  });

  return mission.id;
}

export function formatIssueDetail(issue: Awaited<ReturnType<typeof loadIssueDetail>>) {
  if (!issue) return null;
  const latestState = issue.stateSnapshots?.[0] ?? null;
  return {
    ...issue,
    pendingQuestions: asStringArray(issue.pendingQuestions),
    clarifyingAnswers: asStringArray(issue.clarifyingAnswers),
    outcome: issue.outcome
      ? {
          ...issue.outcome,
          secondaryGoals: asStringArray(issue.outcome.secondaryGoals),
        }
      : null,
    currentStep: issue.steps.find((s) => s.status === "CURRENT") ?? null,
    latestState: latestState
      ? {
          id: latestState.id,
          detectedState: latestState.detectedState,
          emotionalIntensity: latestState.emotionalIntensity,
          decisionRisk: latestState.decisionRisk,
          delayMajorDecisions: latestState.delayMajorDecisions,
          suggestedAction: latestState.suggestedAction,
          aiReasoningSummary: latestState.aiReasoningSummary,
        }
      : null,
    agentActions: (issue.agentActions ?? []).map(formatAgentAction),
    currentAgentAction: (() => {
      const currentStepId = issue.steps.find((s) => s.status === "CURRENT")?.id;
      const raw = (issue.agentActions ?? []).find(
        (a) => a.actionStepId === currentStepId && a.status !== "CANCELLED"
      );
      return raw ? formatAgentAction(raw) : null;
    })(),
    stateSnapshots: undefined,
  };
}

export async function loadIssueDetail(issueId: string, userId: string) {
  return prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: {
      outcome: true,
      constraints: { orderBy: { severity: "desc" } },
      steps: { orderBy: { priorityOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, take: 40 },
      checkIns: { orderBy: { createdAt: "desc" }, take: 5 },
      stateSnapshots: { orderBy: { createdAt: "desc" }, take: 1, include: { matchedPattern: true } },
      agentActions: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      promotedMission: { select: { id: true, title: true } },
    },
  });
}
