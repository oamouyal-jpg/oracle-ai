import { prisma } from "./prisma.js";

const DEV_EMAIL = "operator@oracle.local";

export async function resolveUserId(headerUserId?: string): Promise<string> {
  if (headerUserId) {
    const user = await prisma.user.findUnique({ where: { id: headerUserId } });
    if (user) return user.id;
  }

  let user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        name: "Operator",
        strategicProfile: {
          patterns: [],
          strengths: ["Strategic thinking", "High ambition"],
          triggers: ["Uncertainty", "Overcommitment"],
        },
      },
    });
  }
  return user.id;
}
