import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMPTY_JSON_FIELDS: Record<string, string[]> = {
  Domain: ["goals", "activeIssues"],
  Mission: ["blockers", "risks", "nextActions"],
  DailyBriefing: ["topPriorities", "reminders"],
  NightDebrief: ["behavioralNotes"],
  JournalEntry: ["tags"],
  EmotionalLog: ["triggers"],
  AlignmentSnapshot: ["frictionAreas", "patterns", "recommendations"],
  TradingDailyLog: ["ruleViolations"],
};

async function main() {
  const domains = await prisma.$queryRawUnsafe<{ id: string; goals: string; activeIssues: string }[]>(
    `SELECT id, goals, activeIssues FROM Domain`
  );
  for (const row of domains) {
    await prisma.domain.update({
      where: { id: row.id },
      data: {
        goals: parseJson(row.goals, []),
        activeIssues: parseJson(row.activeIssues, []),
      },
    });
  }

  const missions = await prisma.$queryRawUnsafe<
    { id: string; blockers: string; risks: string; nextActions: string }[]
  >(`SELECT id, blockers, risks, nextActions FROM Mission`);
  for (const row of missions) {
    await prisma.mission.update({
      where: { id: row.id },
      data: {
        blockers: parseJson(row.blockers, []),
        risks: parseJson(row.risks, []),
        nextActions: parseJson(row.nextActions, []),
        momentumScore: 0,
        stabilityScore: 50,
        resistanceScore: 0,
      },
    });
  }

  console.log("JSON fields repaired.");
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
