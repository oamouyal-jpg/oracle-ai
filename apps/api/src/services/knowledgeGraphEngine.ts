import { prisma } from "../lib/prisma.js";
import { Prisma, type GraphNodeKind, type GraphEdgeKind } from "@prisma/client";

export type GraphPayload = {
  nodes: { id: string; kind: string; label: string; refId: string | null; meta: Record<string, unknown> }[];
  edges: { id: string; from: string; to: string; kind: string; strength: number }[];
};

/** Build / refresh knowledge graph from existing user data + HDOS entities. */
export async function rebuildKnowledgeGraph(userId: string): Promise<GraphPayload> {
  await prisma.graphEdge.deleteMany({ where: { userId } });
  await prisma.graphNode.deleteMany({ where: { userId } });

  const nodeId = new Map<string, string>();

  async function ensureNode(kind: GraphNodeKind, refId: string | null, label: string, meta: Record<string, unknown> = {}) {
    const key = `${kind}:${refId ?? label}`;
    if (nodeId.has(key)) return nodeId.get(key)!;
    const n = await prisma.graphNode.create({
      data: { userId, kind, refId, label: label.slice(0, 120), meta: meta as Prisma.InputJsonValue },
    });
    nodeId.set(key, n.id);
    return n.id;
  }

  async function link(from: string, to: string, kind: GraphEdgeKind = "RELATED", strength = 50) {
    if (from === to) return;
    await prisma.graphEdge.create({ data: { userId, fromNodeId: from, toNodeId: to, kind, strength } });
  }

  const [missions, clarity, memories, journals, people, ideas, learning] = await Promise.all([
    prisma.mission.findMany({ where: { userId, status: "ACTIVE" }, take: 20 }),
    prisma.clarityIssue.findMany({ where: { userId, status: { in: ["ACTIVE", "CLARIFYING"] } }, take: 15 }),
    prisma.aIMemory.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 25 }),
    prisma.journalEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.relationship.findMany({ where: { userId }, take: 15 }),
    prisma.creativeIdea.findMany({ where: { userId, status: { in: ["SPARK", "DEVELOPING"] } }, take: 15 }),
    prisma.learningTopic.findMany({ where: { userId }, take: 15 }),
  ]);

  const missionNodes: string[] = [];
  for (const m of missions) {
    missionNodes.push(await ensureNode("MISSION", m.id, m.title, { progress: m.progress }));
  }

  for (const c of clarity) {
    const cid = await ensureNode("CLARITY", c.id, c.title, { status: c.status });
    if (c.promotedMissionId) {
      const mid = await ensureNode("MISSION", c.promotedMissionId, c.title);
      await link(cid, mid, "SUPPORTS", 70);
    } else if (missionNodes[0]) {
      await link(cid, missionNodes[0]!, "RELATED", 40);
    }
  }

  for (const mem of memories) {
    const nid = await ensureNode("MEMORY", mem.id, mem.content.slice(0, 80), { category: mem.category });
    if (missionNodes[0]) await link(nid, missionNodes[0]!, "RELATED", mem.importance);
  }

  for (const j of journals) {
    const jid = await ensureNode("JOURNAL", j.id, j.content.slice(0, 60), { mood: j.mood });
    if (missionNodes[0]) await link(jid, missionNodes[0]!, "INSPIRED_BY", 45);
  }

  for (const p of people) {
    await ensureNode("PERSON", p.id, p.name, { role: p.role });
  }

  for (const idea of ideas) {
    const iid = await ensureNode("IDEA", idea.id, idea.title);
    if (missionNodes[0]) await link(iid, missionNodes[0]!, "INSPIRED_BY", 55);
  }

  for (const t of learning) {
    await ensureNode("LEARNING", t.id, t.topic, { proficiency: t.proficiency });
  }

  return getKnowledgeGraph(userId);
}

export async function getKnowledgeGraph(userId: string): Promise<GraphPayload> {
  const [nodes, edges] = await Promise.all([
    prisma.graphNode.findMany({ where: { userId }, take: 200 }),
    prisma.graphEdge.findMany({ where: { userId }, take: 400 }),
  ]);

  if (nodes.length === 0) return rebuildKnowledgeGraph(userId);

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      refId: n.refId,
      meta: (n.meta as Record<string, unknown>) ?? {},
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.fromNodeId,
      to: e.toNodeId,
      kind: e.kind,
      strength: e.strength,
    })),
  };
}

/** Surface memories relevant to current missions/clarity (keyword overlap v0). */
export async function getRelevantMemories(userId: string, limit = 5) {
  const [memories, missions] = await Promise.all([
    prisma.aIMemory.findMany({ where: { userId }, orderBy: { importance: "desc" }, take: 40 }),
    prisma.mission.findMany({ where: { userId, status: "ACTIVE" }, select: { title: true }, take: 5 }),
  ]);

  const keywords = missions
    .flatMap((m) => m.title.toLowerCase().split(/\W+/))
    .filter((w) => w.length > 3);

  const scored = memories.map((mem) => {
    const text = mem.content.toLowerCase();
    const score = keywords.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);
    return { mem, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.mem.importance - a.mem.importance)
    .slice(0, limit)
    .map((s) => s.mem);
}
