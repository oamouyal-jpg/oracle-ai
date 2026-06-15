import { prisma } from "../lib/prisma.js";

/** Completed clarity issues auto-archive after this many milliseconds (24 hours). */
export const COMPLETED_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;

function archiveCutoff() {
  return new Date(Date.now() - COMPLETED_ARCHIVE_AFTER_MS);
}

/** Move completed issues older than 24h to ARCHIVED so they leave the active list. */
export async function archiveStaleCompletedIssues(userId: string): Promise<number> {
  const cutoff = archiveCutoff();
  const result = await prisma.clarityIssue.updateMany({
    where: {
      userId,
      status: "COMPLETED",
      OR: [
        { completedAt: { lte: cutoff } },
        { completedAt: null, updatedAt: { lte: cutoff } },
      ],
    },
    data: { status: "ARCHIVED" },
  });
  return result.count;
}

/** Delete issue and any week-plan tasks linked from its steps. */
export async function deleteClarityIssueWithCleanup(
  issueId: string,
  userId: string
): Promise<void> {
  const issue = await prisma.clarityIssue.findFirst({
    where: { id: issueId, userId },
    include: { steps: { select: { linkedTaskId: true } } },
  });
  if (!issue) throw new Error("Issue not found");

  const linkedTaskIds = issue.steps
    .map((s) => s.linkedTaskId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    if (linkedTaskIds.length > 0) {
      await tx.task.deleteMany({ where: { id: { in: linkedTaskIds }, userId } });
    }
    await tx.clarityIssue.delete({ where: { id: issueId } });
  });
}
