import { prisma } from "../lib/prisma.js";

const DEFAULT_DOMAINS = [
  { name: "Health", slug: "health", icon: "⬡", color: "#22c55e" },
  { name: "Relationships", slug: "relationships", icon: "◇", color: "#ec4899" },
  { name: "Business", slug: "business", icon: "▣", color: "#3b82f6" },
  { name: "Money", slug: "money", icon: "◈", color: "#eab308" },
  { name: "Mental State", slug: "mental", icon: "◎", color: "#a855f7" },
  { name: "Projects", slug: "projects", icon: "⬢", color: "#06b6d4" },
  { name: "Purpose", slug: "purpose", icon: "✦", color: "#f97316" },
];

/** Empty life-domain scaffold for a new operator — no personal missions or seed content. */
export async function bootstrapNewUser(userId: string): Promise<void> {
  const existing = await prisma.domain.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.domain.createMany({
    data: DEFAULT_DOMAINS.map((d) => ({
      userId,
      name: d.name,
      slug: d.slug,
      icon: d.icon,
      color: d.color,
      progress: 0,
      goals: [],
      activeIssues: [],
    })),
  });
}
