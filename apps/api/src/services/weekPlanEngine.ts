import { prisma } from "../lib/prisma.js";
import { createChatCompletion } from "../lib/openai.js";
import type { AppLocale } from "../lib/locale.js";
import type { ClarityConstraintType } from "@prisma/client";

const WEEK_PLAN_SYSTEM = `You are Oracle Week Planner — a calm executive function coach for overwhelmed people (including students with ADHD).

Rules:
- Turn a messy brain dump into an ordered week: deadlines first, then urgency, then effort.
- Return 5–15 concrete actions max — each doable in one sitting (15–90 min).
- Assign each step a dueAt ISO datetime within the next 7 days (use realistic times like 16:00 after school).
- One thing at a time: order steps so only the earliest urgent item comes first.
- Include prepareNotes as a short "how to start" prompt for follow-up.
- Never shame. Be direct and kind.
- Respond ONLY with valid json. No markdown.`;

export type WeekPlanStep = {
  title: string;
  description?: string;
  whyThisNow?: string;
  prepareNotes?: string;
  difficulty?: number;
  expectedOutcome?: string;
  completionCriteria?: string;
  dueAt: string;
  urgency?: number;
};

export type WeekPlanPayload = {
  title: string;
  aiSummary: string;
  outcome: {
    northStarStatement: string;
    desiredLifeState?: string;
    primaryGoal?: string;
    secondaryGoals?: string[];
    successDefinition?: string;
    avoidDefinition?: string;
  };
  constraints?: { type: string; description: string; severity: number }[];
  steps: WeekPlanStep[];
};

function localeHint(locale: AppLocale): string {
  if (locale === "he") return "Write all user-facing strings in Hebrew.";
  if (locale === "fr") return "Write all user-facing strings in French.";
  return "Write all user-facing strings in English.";
}

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

async function callWeekPlanJson<T>(
  userPrompt: string,
  locale: AppLocale
): Promise<{ data: T | null; source: "openai" | "offline" }> {
  const result = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${WEEK_PLAN_SYSTEM}\n${localeHint(locale)}` },
      { role: "user", content: userPrompt },
    ],
  });

  if (!result.ok) return { data: null, source: "offline" };
  const text = result.completion.choices[0]?.message?.content ?? "";
  return { data: parseJson<T>(text), source: "openai" };
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

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function morningReminderFor(due: Date): Date {
  const r = new Date(due);
  r.setHours(8, 0, 0, 0);
  if (r.getTime() <= Date.now()) {
    return new Date(Date.now() + 3600000);
  }
  return r;
}

function parseDueAt(raw: string, fallbackIndex: number): Date {
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const d = new Date();
  d.setDate(d.getDate() + Math.min(fallbackIndex + 1, 6));
  d.setHours(16, 0, 0, 0);
  return d;
}

function offlineWeekPlan(rawInput: string): WeekPlanPayload {
  const lower = rawInput.toLowerCase();
  const hasExam = /exam|test|quiz|מבחן|contrôle/i.test(rawInput);
  const hasSchool = /school|homework|class|שיעור|בית ספר|école/i.test(rawInput);

  const steps: WeekPlanStep[] = [];
  const addDays = (n: number, hour = 16) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  if (hasExam || hasSchool) {
    steps.push(
      {
        title: "List every exam, assignment, and deadline on one page",
        description: "Brain dump → table with subject, due date, and % done.",
        whyThisNow: "You can't prioritize what isn't visible.",
        prepareNotes: "Open notebook or notes app. 10 minutes max.",
        difficulty: 3,
        completionCriteria: "All items this week are written with dates.",
        dueAt: addDays(0, 17),
        urgency: 10,
      },
      {
        title: "Pick the nearest exam — gather materials in one folder",
        description: "Notes, syllabus, practice tests for that subject only.",
        whyThisNow: "Scattered materials = avoidance.",
        prepareNotes: "One subject. Stop when folder is ready.",
        difficulty: 4,
        completionCriteria: "Folder or digital folder exists for #1 priority exam.",
        dueAt: addDays(0, 19),
        urgency: 9,
      },
      {
        title: "25-minute focus block: review weakest topic for nearest exam",
        description: "Timer on. One topic. No phone.",
        whyThisNow: "Short wins beat marathon panic.",
        prepareNotes: "Set 25-min timer before opening books.",
        difficulty: 5,
        completionCriteria: "Timer completed; one page of notes or 5 practice items.",
        dueAt: addDays(1, 16),
        urgency: 8,
      },
      {
        title: "Second 25-minute block on same subject OR start next deadline",
        description: "Repeat or switch to next urgent item from your list.",
        whyThisNow: "Momentum from yesterday — don't lose it.",
        prepareNotes: "Check list — what's due next?",
        difficulty: 5,
        completionCriteria: "Second block done or next assignment started.",
        dueAt: addDays(2, 16),
        urgency: 7,
      },
      {
        title: "Submit / hand in anything due in the next 48 hours",
        description: "Finish and send — partial beats perfect late.",
        whyThisNow: "Deadlines don't wait for clarity.",
        prepareNotes: "Identify what's due in 48h only.",
        difficulty: 6,
        completionCriteria: "Submitted or ready to submit before deadline.",
        dueAt: addDays(3, 15),
        urgency: 9,
      }
    );
  } else {
    steps.push(
      {
        title: "Write every commitment this week — one line each",
        description: "Dump all tasks, appointments, deadlines.",
        whyThisNow: "Externalize the load from your head.",
        prepareNotes: "5–10 min timer.",
        difficulty: 3,
        completionCriteria: "Full list on paper or screen.",
        dueAt: addDays(0, 18),
        urgency: 10,
      },
      {
        title: "Star the 3 items with real deadlines",
        description: "Circle what breaks if it's late.",
        whyThisNow: "Not everything is equally urgent.",
        prepareNotes: "Look for dates others gave you.",
        difficulty: 3,
        completionCriteria: "Three starred items identified.",
        dueAt: addDays(0, 19),
        urgency: 9,
      },
      {
        title: "Do the smallest action on starred item #1",
        description: "One email, one paragraph, one call — 20 min max.",
        whyThisNow: "Motion beats planning.",
        prepareNotes: "Define 'smallest' before starting.",
        difficulty: 5,
        completionCriteria: "One external action completed.",
        dueAt: addDays(1, 10),
        urgency: 8,
      }
    );
  }

  if (lower.includes("math") || lower.includes("מתמטיקה")) {
    steps.push({
      title: "Math: 20 practice problems on weakest unit",
      description: "Focus one unit only for the nearest math deadline.",
      whyThisNow: "Math rewards reps, not re-reading.",
      prepareNotes: "Calculator, paper, timer 25 min.",
      difficulty: 6,
      completionCriteria: "20 problems attempted; errors noted.",
      dueAt: addDays(2, 17),
      urgency: 8,
    });
  }

  return {
    title: hasSchool ? "School week — exams & deadlines" : "This week — ordered",
    aiSummary:
      "Oracle sorted your dump by deadline and urgency. Work one step at a time — finish today's item before scanning the rest of the week.",
    outcome: {
      northStarStatement: hasSchool
        ? "Get through this school week without last-minute panic — one clear task at a time."
        : "Complete this week with clarity — deadlines met, brain not on fire.",
      desiredLifeState: "Calm focus on today's one task; the week is already mapped.",
      primaryGoal: "Nothing important slips because it was invisible.",
      secondaryGoals: ["Reduce overwhelm", "Build daily momentum"],
      successDefinition: "Each day you finish today's Oracle task before worrying about tomorrow.",
      avoidDefinition: "Multitasking everything at once or shame spirals.",
    },
    constraints: [
      {
        type: "TIME",
        description: "Multiple deadlines competing for attention.",
        severity: 8,
      },
      ...(hasSchool
        ? [{ type: "EMOTIONAL", description: "Overwhelm and messy thinking under pressure.", severity: 7 }]
        : []),
    ],
    steps: steps.sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    ),
  };
}

function buildWeekPlanPrompt(rawInput: string, locale: AppLocale) {
  const weekEnd = new Date(startOfWeek());
  weekEnd.setDate(weekEnd.getDate() + 7);
  return `Today is ${new Date().toISOString().slice(0, 10)}. Plan through ${weekEnd.toISOString().slice(0, 10)}.

Return valid json with keys:
{
  "title": "short title max 60 chars",
  "aiSummary": "2-3 sentences — calm, validating",
  "outcome": {
    "northStarStatement": "one sentence week focus",
    "desiredLifeState": "string",
    "primaryGoal": "string",
    "secondaryGoals": ["..."],
    "successDefinition": "string",
    "avoidDefinition": "string"
  },
  "constraints": [{ "type": "TIME|...", "description": "string", "severity": 1-10 }],
  "steps": [{
    "title": "string",
    "description": "string",
    "whyThisNow": "string",
    "prepareNotes": "short start prompt for follow-up",
    "difficulty": 1-10,
    "completionCriteria": "string",
    "dueAt": "ISO 8601 datetime within next 7 days",
    "urgency": 1-10
  }]
}

Order steps by dueAt ascending. ${localeHint(locale)}

Brain dump:
${rawInput}`;
}

export async function synthesizeWeekPlan(
  issueId: string,
  userId: string,
  locale: AppLocale
): Promise<"openai" | "offline"> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId, mode: "WEEK_PLAN" },
  });
  if (!issue) throw new Error("Week plan not found");

  const prompt = buildWeekPlanPrompt(issue.rawInput, locale);
  let plan: WeekPlanPayload;

  const { data, source } = await callWeekPlanJson<WeekPlanPayload>(prompt, locale);

  if (data?.outcome?.northStarStatement && Array.isArray(data.steps) && data.steps.length > 0) {
    plan = {
      ...data,
      steps: [...data.steps].sort((a, b) => {
        const ta = new Date(a.dueAt).getTime();
        const tb = new Date(b.dueAt).getTime();
        if (ta !== tb) return ta - tb;
        return (b.urgency ?? 5) - (a.urgency ?? 5);
      }),
    };
  } else {
    plan = offlineWeekPlan(issue.rawInput);
  }

  await prisma.$transaction(async (tx) => {
    await tx.clarityOutcome.deleteMany({ where: { issueId } });
    await tx.clarityConstraint.deleteMany({ where: { issueId } });
    await tx.clarityStep.deleteMany({ where: { issueId } });

    await tx.clarityIssue.update({
      where: { id: issueId },
      data: {
        title: plan.title,
        aiSummary: plan.aiSummary,
        weekStartDate: startOfWeek(),
        status: "ACTIVE",
        pendingQuestions: [],
      },
    });

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
      const dueAt = parseDueAt(s.dueAt, i);
      const reminderAt = morningReminderFor(dueAt);

      const task = await tx.task.create({
        data: {
          userId,
          title: s.title,
          description: [
            s.description,
            s.whyThisNow ? `Why now: ${s.whyThisNow}` : "",
            s.prepareNotes ? `Start: ${s.prepareNotes}` : "",
            s.completionCriteria ? `Done when: ${s.completionCriteria}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          dueDate: dueAt,
          scheduledAt: dueAt,
          reminderAt,
          priority: Math.min(99, 70 + (s.urgency ?? 5)),
          aiGenerated: false,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
        },
      });

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
          dueAt,
          linkedTaskId: task.id,
        },
      });
    }

    await tx.clarityMessage.create({
      data: {
        userId,
        issueId,
        role: "ASSISTANT",
        kind: "ANALYSIS",
        content:
          "Your week is mapped. Oracle will remind you each day — focus only on the current task until it's done.",
      },
    });
  });

  return source;
}

export async function createWeekPlan(
  userId: string,
  rawInput: string,
  locale: AppLocale
): Promise<{ source: "openai" | "offline"; issueId: string }> {
  const issue = await prisma.clarityIssue.create({
    data: {
      userId,
      title: "Week plan",
      rawInput: rawInput.trim(),
      mode: "WEEK_PLAN",
      status: "INTAKE",
    },
  });

  await prisma.clarityMessage.create({
    data: {
      userId,
      issueId: issue.id,
      role: "USER",
      kind: "INTAKE",
      content: rawInput.trim(),
    },
  });

  const source = await synthesizeWeekPlan(issue.id, userId, locale);
  return { source, issueId: issue.id };
}

export function enrichWeekPlanDetail(issue: {
  mode: string;
  weekStartDate: Date | null;
  steps: { dueAt: Date | null; status: string }[];
}) {
  if (issue.mode !== "WEEK_PLAN") return {};

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  const todaySteps = issue.steps.filter((s) => {
    if (!s.dueAt) return s.status === "CURRENT";
    const d = new Date(s.dueAt);
    return d >= startToday && d <= endToday;
  });

  const overdueCount = issue.steps.filter(
    (s) =>
      s.dueAt &&
      new Date(s.dueAt).getTime() < startToday.getTime() &&
      s.status !== "COMPLETED" &&
      s.status !== "SKIPPED"
  ).length;

  return {
    mode: "WEEK_PLAN" as const,
    weekStartDate: issue.weekStartDate?.toISOString() ?? null,
    todayStepCount: todaySteps.length,
    overdueCount,
  };
}
