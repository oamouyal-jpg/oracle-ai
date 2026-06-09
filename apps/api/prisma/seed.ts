import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "operator@oracle.local" },
    update: {},
    create: {
      email: "operator@oracle.local",
      name: "Operator",
      onboardingComplete: true,
      strategicProfile: {
        patterns: ["Avoids admin tasks under stress", "Peak performance: structured mornings"],
        strengths: ["Strategic vision", "Resilience", "Creative problem solving"],
      },
    },
  });

  const domainData = [
    { name: "Health", slug: "health", icon: "⬡", color: "#22c55e", progress: 65 },
    { name: "Relationships", slug: "relationships", icon: "◇", color: "#ec4899", progress: 45 },
    { name: "Business", slug: "business", icon: "▣", color: "#3b82f6", progress: 72 },
    { name: "Money", slug: "money", icon: "◈", color: "#eab308", progress: 38 },
    { name: "Mental State", slug: "mental", icon: "◎", color: "#a855f7", progress: 58 },
    { name: "Projects", slug: "projects", icon: "⬢", color: "#06b6d4", progress: 55 },
    { name: "Purpose", slug: "purpose", icon: "✦", color: "#f97316", progress: 70 },
  ];

  const domains: Record<string, string> = {};
  for (const d of domainData) {
    const domain = await prisma.domain.upsert({
      where: { userId_slug: { userId: user.id, slug: d.slug } },
      update: {},
      create: {
        userId: user.id,
        name: d.name,
        slug: d.slug,
        icon: d.icon,
        color: d.color,
        progress: d.progress,
        currentState: "Active development",
        goals: [`Strengthen ${d.name.toLowerCase()} foundation`],
        activeIssues: d.progress < 50 ? ["Needs focused attention"] : [],
      },
    });
    domains[d.slug] = domain.id;
  }

  const missions = [
    {
      title: "Relocate from Australia to Israel",
      purpose: "Establish new home base with clarity and stability",
      domainId: domains.projects,
      priorityScore: 90,
      progress: 35,
      blockers: ["Housing uncertainty", "Financial organization pending"],
    },
    {
      title: "Build Agentis",
      purpose: "Launch and scale the AI venture",
      domainId: domains.business,
      priorityScore: 95,
      progress: 52,
      blockers: ["Time fragmentation", "Need focused execution blocks"],
    },
    {
      title: "Improve emotional regulation",
      purpose: "Stay grounded under uncertainty",
      domainId: domains.mental,
      priorityScore: 85,
      progress: 60,
      blockers: ["Relocation stress triggers"],
    },
    {
      title: "Organize property and finances",
      purpose: "Reduce uncertainty and cognitive load",
      domainId: domains.money,
      priorityScore: 88,
      progress: 25,
      blockers: ["Avoidance when stressed"],
    },
  ];

  await prisma.mission.create({
    data: {
      userId: user.id,
      title: "Return to Futures Trading Safely",
      missionType: "TRADING",
      purpose:
        "Re-enter futures trading using micro contracts only, with emotional control, strict risk limits, and process-based progress tracking.",
      whyItMatters:
        "Trading is a skill that requires discipline. Safe re-entry protects capital and psychology.",
      desiredOutcome:
        "Consistent rule-following on 1 micro contract with emotional stability before any size increase.",
      domainId: domains.money,
      priorityScore: 92,
      progress: 20,
      emotionalResistance: 75,
      blockers: ["Emotional trading history", "Temptation to size up"],
      risks: ["Revenge trading", "Over-leverage", "Trading when stressed"],
      nextActions: ["Complete daily trading log", "Pre-trade emotional check"],
      tradingConfig: {
        rules: [
          "Start with 1 micro contract only",
          "Trade only MNQ or MES",
          "Track emotional state before and after",
          "Progress by discipline, not profit",
        ],
        maxContracts: 1,
        instruments: ["MNQ", "MES"],
      },
      aiNotes:
        "Re-entry phase: micro size only. No size increases until 10 disciplined sessions logged.",
    },
  });

  for (const m of missions) {
    const mission = await prisma.mission.create({
      data: {
        userId: user.id,
        ...m,
        whyItMatters: m.purpose,
        emotionalResistance: 40,
        estimatedImpact: 85,
      },
    });

    const taskTitles = [
      `Plan next step: ${m.title}`,
      `Review blockers for ${m.title}`,
      `20-min execution block`,
    ];
    for (const [i, title] of taskTitles.entries()) {
      await prisma.task.create({
        data: {
          userId: user.id,
          missionId: mission.id,
          title,
          priority: 80 - i * 10,
          status: i === 0 ? "IN_PROGRESS" : "PENDING",
        },
      });
    }
  }

  await prisma.aIMemory.createMany({
    data: [
      {
        userId: user.id,
        category: "pattern",
        content: "Avoids financial tasks when emotionally stressed",
        importance: 85,
      },
      {
        userId: user.id,
        category: "strength",
        content: "Performs best after exercise and structured mornings",
        importance: 80,
      },
      {
        userId: user.id,
        category: "intention",
        content: "Long-term: aligned life in Israel with thriving business and stable relationships",
        importance: 95,
      },
    ],
  });

  console.log("Seed complete for", user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
