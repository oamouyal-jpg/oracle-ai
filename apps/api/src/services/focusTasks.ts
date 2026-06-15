import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { createChatCompletion } from "../lib/openai.js";
import type { AppLocale } from "../lib/locale.js";
import {
  buildOperatorLearningContext,
  buildOracleSystemPrompt,
  rememberInsight,
} from "../lib/operatorLearning.js";
import { recalculateMissionMomentums } from "./alignmentEngine.js";
import { recalculateDomainHealth } from "./domainHealthEngine.js";
import {
  apiStr,
  mockFollowUpAcknowledgment,
  mockFollowUpQuestion,
} from "../lib/apiLocale.js";

export const FOCUS_QUEUE_SIZE = 3;

const ACTIVE_FOCUS_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PARTIAL",
  "DELAYED",
  "RESCHEDULED",
] as const;
const RECENT_CLOSED_STATUSES = ["COMPLETED", "SKIPPED"] as const;

export type FocusFollowUp = {
  taskId: string;
  question: string;
  priorNote: string | null;
  lastOracleReply: string | null;
};

export type FollowUpResult = {
  task: Awaited<ReturnType<typeof getActiveFocusTasks>>[number];
  acknowledgment: string;
  suggestedStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "SKIPPED" | "DELAYED" | null;
  replenished: { tasks: Awaited<ReturnType<typeof getActiveFocusTasks>>; created: number } | null;
};

type FocusTaskRow = Awaited<ReturnType<typeof getActiveFocusTasks>>[number];

function parseProgressNote(note: string | null | undefined) {
  if (!note?.trim()) return { user: null as string | null, oracle: null as string | null };
  const userMatch = note.match(/User:\s*([\s\S]*?)(?:\nOracle:|$)/);
  const oracleMatch = note.match(/Oracle:\s*([\s\S]*)$/);
  return {
    user: userMatch?.[1]?.trim() ?? note.trim(),
    oracle: oracleMatch?.[1]?.trim() ?? null,
  };
}

function formatProgressNote(user: string, oracle?: string | null) {
  const base = `User: ${user.trim()}`;
  return oracle?.trim() ? `${base}\nOracle: ${oracle.trim()}` : base;
}

function hoursSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function detectFollowUpSignals(progress: string) {
  const lower = progress.toLowerCase();
  return {
    done: /\b(done|finished|completed|complete|סיימתי|הושלם|גמרתי|terminé|fini)\b/u.test(lower),
    partial: /\b(partial|half|some|started|progress|bit|חלקי|התחלתי|partiel|commencé)\b/u.test(
      lower
    ),
    skipped: /\b(skip|didn't|did not|avoid|later|tomorrow|דילגתי|לא עשיתי|sauté|plus tard)\b/u.test(
      lower
    ),
    blocked: /\b(block|stuck|can't|cannot|overwhelm|תקוע|חסום|bloqué)\b/u.test(lower),
  };
}

function offlineFollowUpAcknowledgment(
  task: FocusTaskRow,
  progress: string,
  operatorName: string,
  locale: AppLocale
): { acknowledgment: string; suggestedStatus: FollowUpResult["suggestedStatus"] } {
  const signals = detectFollowUpSignals(progress);

  let suggestedStatus: FollowUpResult["suggestedStatus"] = null;
  if (signals.done) suggestedStatus = "COMPLETED";
  else if (signals.partial) suggestedStatus = "PARTIAL";
  else if (signals.skipped) suggestedStatus = "SKIPPED";
  else if (task.status === "PENDING") suggestedStatus = "IN_PROGRESS";

  const acknowledgment = mockFollowUpAcknowledgment(locale, {
    operatorName,
    taskTitle: task.title,
    ...signals,
  });

  return { acknowledgment, suggestedStatus };
}

export type FocusTaskPayload = {
  title: string;
  description: string;
  missionId: string;
  priority: number;
  estimatedEffort: number;
  emotionalDifficulty: number;
  energyCost: number;
};

export async function getActiveFocusTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      userId,
      aiGenerated: true,
      status: { in: [...ACTIVE_FOCUS_STATUSES] },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: FOCUS_QUEUE_SIZE,
    include: { mission: { select: { id: true, title: true } } },
  });
}

export async function getRecentClosedFocusTasks(userId: string, hours = 48) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return prisma.task.findMany({
    where: {
      userId,
      aiGenerated: true,
      status: { in: [...RECENT_CLOSED_STATUSES] },
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "desc" },
    take: FOCUS_QUEUE_SIZE,
    include: { mission: { select: { id: true, title: true } } },
  });
}

export async function buildFocusFollowUps(
  tasks: FocusTaskRow[],
  locale: AppLocale,
  operatorName: string,
  userId: string
): Promise<FocusFollowUp[]> {
  if (tasks.length === 0) return [];

  const payload = tasks.map((t) => {
    const parsed = parseProgressNote(t.completionNote);
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      mission: t.mission?.title,
      hoursOpen: Math.round(hoursSince(t.createdAt)),
      priorUserNote: parsed.user,
      priorOracleReply: parsed.oracle,
    };
  });

  const learning = await buildOperatorLearningContext(userId);
  const systemPrompt = buildOracleSystemPrompt(
    operatorName,
    learning,
    locale,
    `For each focus task, write a short follow-up question checking completion status and progress.
Return JSON: { "followUps": [{ "taskId": "id from input", "question": "1-2 sentence direct question" }] }
Rules:
- For PENDING/IN_PROGRESS: ask if completed, partial, or not started; reference priorUserNote
- For COMPLETED/PARTIAL/SKIPPED: ask what they learned, what's left, or what blocked them
- If hoursOpen > 24 and still pending, ask what blocked them
- Be direct and warm, not generic`
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ tasks: payload, operatorName }) },
    ],
  });

  const byId = new Map<string, string>();

  if (aiResult.ok) {
    try {
      const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
        followUps?: { taskId: string; question: string }[];
      };
      for (const f of raw.followUps ?? []) {
        if (f.taskId && f.question?.trim()) byId.set(f.taskId, f.question.trim());
      }
    } catch {
      /* offline fallback below */
    }
  }

  return tasks.map((task) => {
    const parsed = parseProgressNote(task.completionNote);
    return {
      taskId: task.id,
      question:
        byId.get(task.id) ??
        mockFollowUpQuestion(locale, {
          operatorName,
          taskTitle: task.title,
          status: task.status,
          priorNote: parsed.user,
          hoursOpen: hoursSince(task.createdAt),
        }),
      priorNote: parsed.user,
      lastOracleReply: parsed.oracle,
    };
  });
}

export async function submitFocusFollowUp(
  userId: string,
  taskId: string,
  progress: string,
  locale: AppLocale = "en"
): Promise<FollowUpResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, aiGenerated: true },
    include: { mission: { select: { id: true, title: true } } },
  });
  if (!task) throw new Error("Task not found");

  const learning = await buildOperatorLearningContext(userId);
  const trimmed = progress.trim();
  if (trimmed.length < 2) throw new Error("Progress update too short");

  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `The operator reports progress on a focus task. Analyze and respond.
Return JSON: {
  "acknowledgment": "2-3 sentences: acknowledge what they said, coach next step",
  "suggestedStatus": "PENDING|IN_PROGRESS|COMPLETED|PARTIAL|SKIPPED|DELAYED|null",
  "insight": "optional short pattern to remember, or null"
}
Rules:
- suggestedStatus reflects their report (completed→COMPLETED, partial→PARTIAL, not started→PENDING, started→IN_PROGRESS, avoiding→SKIPPED)
- Be specific to the task title and mission`
  );

  let acknowledgment = "";
  let suggestedStatus: FollowUpResult["suggestedStatus"] = null;
  let insight: string | null = null;

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            mission: task.mission?.title,
            guidance: task.description,
            priorNote: parseProgressNote(task.completionNote).user,
          },
          progress: trimmed,
        }),
      },
    ],
  });

  if (aiResult.ok) {
    try {
      const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
        acknowledgment?: string;
        suggestedStatus?: FollowUpResult["suggestedStatus"];
        insight?: string | null;
      };
      acknowledgment = String(raw.acknowledgment ?? "").trim();
      suggestedStatus = raw.suggestedStatus ?? null;
      insight = raw.insight?.trim() || null;
    } catch {
      /* fallback */
    }
  }

  if (!acknowledgment) {
    const mock = offlineFollowUpAcknowledgment(task, trimmed, learning.operatorName, locale);
    acknowledgment = mock.acknowledgment;
    suggestedStatus = mock.suggestedStatus;
  }

  const completionNote = formatProgressNote(trimmed, acknowledgment);

  const updateData: Record<string, unknown> = {
    completionNote,
    status: suggestedStatus && suggestedStatus !== task.status ? suggestedStatus : task.status,
  };
  if (suggestedStatus === "COMPLETED") {
    updateData.completedAt = new Date();
  }
  if (suggestedStatus === "IN_PROGRESS" && task.status === "PENDING") {
    updateData.status = "IN_PROGRESS";
  }

  await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  if (insight && insight.length >= 8) {
    await rememberInsight(userId, insight, "pattern", 70).catch(() => {});
  }

  if (task.missionId) {
    await recalculateMissionMomentums(userId);
    await recalculateDomainHealth(userId);
  }

  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: { mission: { select: { id: true, title: true } } },
  });

  let replenished = null;
  if (suggestedStatus && ["COMPLETED", "SKIPPED"].includes(suggestedStatus)) {
    replenished = await replenishFocusQueue(userId, locale);
  }

  return {
    task: updated!,
    acknowledgment,
    suggestedStatus,
    replenished,
  };
}

async function buildMissionContext(userId: string) {
  const missions = await prisma.mission.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { priorityScore: "desc" },
    take: 8,
    include: {
      domain: { select: { name: true } },
      tasks: {
        where: { status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { title: true, status: true },
      },
    },
  });

  return missions.map((m) => ({
    id: m.id,
    title: m.title,
    purpose: m.purpose,
    progress: m.progress,
    priorityScore: m.priorityScore,
    domain: m.domain?.name,
    blockers: asStringArray(m.blockers),
    nextActions: asStringArray(m.nextActions),
    recentTasks: m.tasks,
  }));
}

function mockFocusTasks(
  missions: Awaited<ReturnType<typeof buildMissionContext>>,
  count: number,
  existingTitles: string[],
  locale: AppLocale
): FocusTaskPayload[] {
  const out: FocusTaskPayload[] = [];
  const used = new Set(existingTitles.map((t) => t.toLowerCase()));

  for (const mission of missions) {
    if (out.length >= count) break;
    const candidates: FocusTaskPayload[] = [
      {
        title: apiStr("focusBlock20Title", locale, { mission: mission.title }),
        description: apiStr("focusBlock20Desc", locale, { mission: mission.title }),
        missionId: mission.id,
        priority: 90 - out.length * 5,
        estimatedEffort: 25,
        emotionalDifficulty: 35,
        energyCost: 30,
      },
      {
        title: apiStr("focusClearBlockerTitle", locale, { mission: mission.title }),
        description: mission.blockers[0]
          ? apiStr("focusClearBlockerDescWith", locale, {
              blocker: mission.blockers[0],
            })
          : apiStr("focusClearBlockerDescWithout", locale, { mission: mission.title }),
        missionId: mission.id,
        priority: 85 - out.length * 5,
        estimatedEffort: 30,
        emotionalDifficulty: 45,
        energyCost: 35,
      },
      {
        title: apiStr("focusPlanTitle", locale, { mission: mission.title }),
        description: apiStr("focusPlanDesc", locale),
        missionId: mission.id,
        priority: 80 - out.length * 5,
        estimatedEffort: 20,
        emotionalDifficulty: 25,
        energyCost: 25,
      },
    ];

    for (const c of candidates) {
      if (out.length >= count) break;
      if (used.has(c.title.toLowerCase())) continue;
      used.add(c.title.toLowerCase());
      out.push(c);
    }
  }

  return out.slice(0, count);
}

export async function generateFocusTasks(
  userId: string,
  count: number,
  locale: AppLocale = "en"
): Promise<FocusTaskPayload[]> {
  if (count <= 0) return [];

  const [missions, learning, existing] = await Promise.all([
    buildMissionContext(userId),
    buildOperatorLearningContext(userId),
    prisma.task.findMany({
      where: {
        userId,
        aiGenerated: true,
        status: { in: [...ACTIVE_FOCUS_STATUSES] },
      },
      select: { title: true },
    }),
  ]);

  if (missions.length === 0) return [];

  const existingTitles = existing.map((t) => t.title);
  const systemPrompt = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Generate exactly ${count} executable focus task(s) from the user's active missions.
Return JSON: {
  "overview": "one sentence on what to tackle first",
  "tasks": [{
    "title": "short action title",
    "description": "step-by-step completion guidance (2-4 sentences, specific and practical)",
    "missionId": "must match an input mission id",
    "priority": 50-100,
    "estimatedEffort": 0-100,
    "emotionalDifficulty": 0-100,
    "energyCost": 0-100
  }]
}
Rules:
- Each task must link to a real missionId from input
- Tasks must be concrete (20-45 min), not vague planning
- description is completion guidance — how to finish, not why
- Do not duplicate existing focus task titles
- Spread across missions when possible`
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          missions,
          existingFocusTitles: existingTitles,
          count,
        }),
      },
    ],
  });

  let payloads: FocusTaskPayload[] = [];

  if (aiResult.ok) {
    try {
      const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
        tasks?: FocusTaskPayload[];
      };
      const missionIds = new Set(missions.map((m) => m.id));
      payloads = (raw.tasks ?? [])
        .filter((t) => t.missionId && missionIds.has(t.missionId) && t.title?.trim())
        .slice(0, count)
        .map((t, i) => ({
          title: String(t.title).trim(),
          description: String(t.description ?? "").trim(),
          missionId: t.missionId,
          priority: Number(t.priority) || 85 - i * 5,
          estimatedEffort: Number(t.estimatedEffort) || 30,
          emotionalDifficulty: Number(t.emotionalDifficulty) || 35,
          energyCost: Number(t.energyCost) || 30,
        }));
    } catch {
      payloads = [];
    }
  }

  if (payloads.length < count) {
    const mock = mockFocusTasks(
      missions,
      count - payloads.length,
      [...existingTitles, ...payloads.map((p) => p.title)],
      locale
    );
    payloads = [...payloads, ...mock];
  }

  return payloads.slice(0, count);
}

export async function createFocusTasksFromPayloads(userId: string, payloads: FocusTaskPayload[]) {
  if (payloads.length === 0) return [];

  await prisma.task.createMany({
    data: payloads.map((p) => ({
      userId,
      missionId: p.missionId,
      title: p.title,
      description: p.description,
      priority: p.priority,
      estimatedEffort: p.estimatedEffort,
      emotionalDifficulty: p.emotionalDifficulty,
      energyCost: p.energyCost,
      aiGenerated: true,
      status: "PENDING" as const,
    })),
  });

  return getActiveFocusTasks(userId);
}

export async function applyAIPrioritization(
  userId: string,
  tasks: FocusTaskRow[],
  locale: AppLocale,
  operatorName: string
): Promise<{ recommendation: string; insights: string[] }> {
  if (tasks.length === 0) {
    return { recommendation: "Add an active mission so Oracle can build your task queue.", insights: [] };
  }

  const learning = await buildOperatorLearningContext(userId);
  const payload = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    mission: t.mission?.title,
    effort: t.estimatedEffort,
    difficulty: t.emotionalDifficulty,
    priorNote: parseProgressNote(t.completionNote).user,
  }));

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
  const fallback = {
    recommendation: `${operatorName}, start with "${sorted[0]?.title}" — highest leverage in your queue.`,
    insights: [] as string[],
    orderedTaskIds: sorted.map((t) => t.id),
  };

  const systemPrompt = buildOracleSystemPrompt(
    operatorName,
    learning,
    locale,
    `Prioritize the operator's active AI-assisted tasks until each is completed.
Return JSON: {
  "recommendation": "1-2 sentences: what to do first and why",
  "orderedTaskIds": ["task ids in execution order"],
  "insights": ["optional short patterns, max 2"]
}
Rules:
- PARTIAL tasks needing closure rank above brand-new PENDING tasks
- IN_PROGRESS beats untouched PENDING when momentum exists
- Factor emotional difficulty and mission leverage`
  );

  const aiResult = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify({ tasks: payload }) },
    ],
  });

  let result = fallback;
  if (aiResult.ok) {
    try {
      const raw = JSON.parse(aiResult.completion.choices[0]?.message?.content ?? "{}") as {
        recommendation?: string;
        orderedTaskIds?: string[];
        insights?: string[];
      };
      const validIds = new Set(tasks.map((t) => t.id));
      const ordered = (raw.orderedTaskIds ?? []).filter((id) => validIds.has(id));
      for (const t of tasks) {
        if (!ordered.includes(t.id)) ordered.push(t.id);
      }
      result = {
        recommendation: raw.recommendation?.trim() || fallback.recommendation,
        insights: Array.isArray(raw.insights) ? raw.insights.map(String).slice(0, 2) : [],
        orderedTaskIds: ordered,
      };
    } catch {
      result = fallback;
    }
  }

  await Promise.all(
    result.orderedTaskIds.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { priority: 100 - index * 5 },
      })
    )
  );

  return { recommendation: result.recommendation, insights: result.insights };
}

export async function ensureFocusQueue(userId: string, locale: AppLocale = "en") {
  let tasks = await getActiveFocusTasks(userId);
  let created = 0;

  if (tasks.length < FOCUS_QUEUE_SIZE) {
    const needed = FOCUS_QUEUE_SIZE - tasks.length;
    const payloads = await generateFocusTasks(userId, needed, locale);
    if (payloads.length > 0) {
      await createFocusTasksFromPayloads(userId, payloads);
      created = payloads.length;
      tasks = await getActiveFocusTasks(userId);
    }
  }

  const learning = await buildOperatorLearningContext(userId);
  const prioritization = await applyAIPrioritization(
    userId,
    tasks,
    locale,
    learning.operatorName
  );
  tasks = await getActiveFocusTasks(userId);

  const [followUps, recentClosed] = await Promise.all([
    buildFocusFollowUps(tasks, locale, learning.operatorName, userId),
    getRecentClosedFocusTasks(userId),
  ]);

  const recentFollowUps =
    recentClosed.length > 0
      ? await buildFocusFollowUps(recentClosed, locale, learning.operatorName, userId)
      : [];

  return {
    tasks,
    created,
    overview: prioritization.recommendation,
    queueSize: FOCUS_QUEUE_SIZE,
    followUps,
    recentFollowUps,
    prioritization,
  };
}

export async function replenishFocusQueue(userId: string, locale: AppLocale = "en") {
  const tasks = await getActiveFocusTasks(userId);
  const needed = FOCUS_QUEUE_SIZE - tasks.length;
  if (needed <= 0) {
    return { tasks, created: 0 };
  }

  const payloads = await generateFocusTasks(userId, needed, locale);
  if (payloads.length === 0) {
    return { tasks, created: 0 };
  }

  await createFocusTasksFromPayloads(userId, payloads);
  const updated = await getActiveFocusTasks(userId);
  return { tasks: updated, created: payloads.length };
}
