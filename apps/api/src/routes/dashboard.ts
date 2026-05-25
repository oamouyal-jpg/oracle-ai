import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { asStringArray } from "../lib/arrays.js";
import { resolveUserId } from "../lib/user.js";
import { getAlignmentDashboard } from "../services/alignmentEngine.js";
import { requestLocale } from "../lib/requestLocale.js";
import { localizeDomain, localizeDomainName } from "../lib/contentLocale.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", asyncHandler(async (req, res) => {
  try {
    const userId = await resolveUserId(req.headers["x-user-id"] as string);

    let alignmentData = null;
    try {
      alignmentData = await getAlignmentDashboard(userId);
    } catch (e) {
      console.error("Alignment dashboard error:", e);
    }

    const [domains, missions, tasks, briefing, lastDebrief] = await Promise.all([
      prisma.domain.findMany({
        where: { userId },
        orderBy: { priority: "desc" },
      }),
      prisma.mission.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: { momentumScore: "desc" },
        take: 6,
        include: { domain: true },
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ["PENDING", "IN_PROGRESS", "DELAYED"] } },
        orderBy: { priority: "desc" },
        take: 10,
        include: { mission: { select: { title: true } } },
      }),
      prisma.dailyBriefing.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.nightDebrief.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const completedToday = await prisma.task.count({
    where: {
      userId,
      status: { in: ["COMPLETED", "PARTIAL"] },
      completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  const locale = requestLocale(req);
  const stressDomains = domains
    .filter((d) => asStringArray(d.activeIssues).length > 0 || d.progress < 40)
    .map((d) => localizeDomainName(d.slug, locale, d.name));

  const momentum =
    missions.length > 0
      ? Math.round(missions.reduce((s, m) => s + m.momentumScore, 0) / missions.length)
      : 0;

  res.json({
    stats: {
      activeMissions: missions.length,
      pendingTasks: tasks.length,
      completedToday,
      momentum,
      alignmentScore: alignmentData?.alignment?.alignmentScore ?? null,
      isLifeMovingForward: alignmentData?.isLifeMovingForward ?? null,
      energyLevel: 70,
    },
    domains: domains.map((d) => localizeDomain(d, locale)),
    missions: missions.map((m) => ({
      ...m,
      domain: m.domain ? localizeDomain(m.domain, locale) : null,
    })),
    topTasks: tasks,
    briefing,
    lastDebrief,
    alignment: alignmentData?.alignment ?? null,
    alignmentRecommendations: alignmentData?.alignment?.recommendations
      ? asStringArray(alignmentData.alignment.recommendations)
      : [],
    patterns: alignmentData?.patterns ?? [],
    frictionInsights: alignmentData?.frictionInsights ?? [],
    emotionalTrend: alignmentData?.emotionalTrend ?? [],
    stressAreas: stressDomains,
    lifeMap: {
      missionStatus: missions.map((m) => ({
        id: m.id,
        title: m.title,
        progress: m.progress,
        momentum: m.momentumScore,
        stability: m.stabilityScore,
        resistance: m.resistanceScore,
        priority: m.priorityScore,
        domain: m.domain
          ? localizeDomainName(m.domain.slug, locale, m.domain.name)
          : null,
      })),
      domainHealth: domains.map((d) => ({
        name: localizeDomainName(d.slug, locale, d.name),
        slug: d.slug,
        progress: d.progress,
        color: d.color,
      })),
    },
  });
  } catch (e) {
    console.error("Dashboard error:", e);
    res.status(500).json({
      error: "Dashboard failed",
      hint: "Try: npm.cmd run db:reset -w @oracle/api",
    });
  }
}));
