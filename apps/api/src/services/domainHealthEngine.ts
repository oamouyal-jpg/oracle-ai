import { prisma } from "../lib/prisma.js";

const OPEN_TASK_STATUSES = new Set([
  "PENDING",
  "IN_PROGRESS",
  "PARTIAL",
  "DELAYED",
  "RESCHEDULED",
]);
const DONE_TASK_STATUSES = new Set(["COMPLETED", "PARTIAL"]);

type MissionWithTasks = {
  progress: number;
  tasks: { status: string }[];
};

export function computeDomainProgress(missions: MissionWithTasks[]): number {
  if (missions.length === 0) return 0;

  const scores = missions.map((m) => {
    const total = m.tasks.length;
    if (total === 0) return m.progress;
    const done = m.tasks.filter((t) => DONE_TASK_STATUSES.has(t.status)).length;
    const taskPct = Math.round((done / total) * 100);
    return Math.round(m.progress * 0.35 + taskPct * 0.65);
  });

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function domainIssues(missions: MissionWithTasks[], progress: number): string[] {
  if (missions.length === 0) return [];
  const issues: string[] = [];
  if (progress < 45) issues.push("Needs focused attention");
  const stalled = missions.some(
    (m) =>
      m.tasks.length > 0 &&
      m.tasks.every((t) => OPEN_TASK_STATUSES.has(t.status) || t.status === "SKIPPED")
  );
  if (stalled && progress < 55) issues.push("No completed tasks yet");
  return issues;
}

function domainState(missions: MissionWithTasks[], progress: number): string | null {
  if (missions.length === 0) return null;
  if (progress >= 60) return "on_track";
  if (progress >= 30) return "active";
  return "needs_attention";
}

export async function recalculateDomainHealth(userId: string): Promise<void> {
  const domains = await prisma.domain.findMany({
    where: { userId },
    include: {
      missions: {
        where: { status: "ACTIVE" },
        include: {
          tasks: { select: { status: true } },
        },
      },
    },
  });

  for (const domain of domains) {
    const progress = computeDomainProgress(domain.missions);
    await prisma.domain.update({
      where: { id: domain.id },
      data: {
        progress,
        activeIssues: domainIssues(domain.missions, progress),
        currentState: domainState(domain.missions, progress),
      },
    });
  }
}
