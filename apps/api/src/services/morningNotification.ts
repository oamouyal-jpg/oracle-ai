import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import type { AppLocale } from "../lib/locale.js";
import { getOperatorName } from "../lib/operatorLearning.js";
import { getActiveFocusTasks } from "./focusTasks.js";
import { apiStr } from "../lib/apiLocale.js";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function buildMorningNotification(userId: string, locale: AppLocale = "en") {
  const today = startOfDay();
  const [operatorName, briefing, focusTasks] = await Promise.all([
    getOperatorName(userId),
    prisma.dailyBriefing.findFirst({
      where: { userId, date: { gte: today } },
      orderBy: { date: "desc" },
    }),
    getActiveFocusTasks(userId),
  ]);

  const topTask = focusTasks[0];
  const focusLine =
    topTask?.title ??
    briefing?.focusRecommendation ??
    apiStr("morningFallback", locale);

  const bodyParts: string[] = [];
  if (topTask) {
    bodyParts.push(apiStr("morningTopTask", locale, { task: topTask.title }));
  }
  const priorities = asStringArray(briefing?.topPriorities);
  if (briefing?.focusRecommendation) {
    bodyParts.push(briefing.focusRecommendation);
  } else if (priorities.length > 0) {
    bodyParts.push(priorities[0]!);
  }

  const body = bodyParts.join(" · ").slice(0, 220) || focusLine.slice(0, 220);

  return {
    title: apiStr("morningTitle", locale, { name: operatorName }),
    body,
    url: topTask ? "/tasks" : "/briefing",
    topTaskTitle: topTask?.title ?? null,
    focusRecommendation: briefing?.focusRecommendation ?? null,
  };
}
