import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { createChatCompletion } from "../lib/openai.js";
import { buildOperatorLearningContext, buildOracleSystemPrompt, rememberInsight } from "../lib/operatorLearning.js";
import type { AppLocale } from "../lib/locale.js";
import { getRelevantMemories } from "./knowledgeGraphEngine.js";

function parseJsonArray<T>(raw: string): T[] {
  try {
    const j = JSON.parse(raw) as { items?: T[] } | T[];
    if (Array.isArray(j)) return j;
    return j.items ?? [];
  } catch {
    return [];
  }
}

/** AI-generate knowledge items from user context (no external fetch in v0 — structured insights). */
export async function generateKnowledgeItems(userId: string, locale: AppLocale = "en") {
  const [learning, missions, existing] = await Promise.all([
    buildOperatorLearningContext(userId),
    prisma.mission.findMany({ where: { userId, status: "ACTIVE" }, take: 5 }),
    prisma.knowledgeItem.count({ where: { userId } }),
  ]);

  if (existing >= 20) return prisma.knowledgeItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 });

  const system = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Generate 3-5 knowledge insights tailored to the user's active life context. Each item: title, summary (2-3 sentences), source (e.g. "Oracle synthesis"), biasNote (possible bias to watch), uncertainty (what we don't know), tags (string[]), relevance (0-100). Frame competing viewpoints where relevant. Return JSON: { "items": [...] }`
  );

  const result = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Active missions: ${missions.map((m) => m.title).join("; ") || "none"}\nProfile patterns: ${learning.strategicProfile.patterns.join("; ")}`,
      },
    ],
  });

  type Item = {
    title: string;
    summary: string;
    source?: string;
    biasNote?: string;
    uncertainty?: string;
    tags?: string[];
    relevance?: number;
  };

  let items: Item[] = [];
  if (result.ok) {
    items = parseJsonArray<Item>(result.completion.choices[0]?.message?.content ?? "{}");
  }

  if (items.length === 0) {
    items = [
      {
        title: "Focus beats breadth",
        summary: "Your active mission load suggests narrowing to one leverage move today will outperform scattered effort.",
        source: "Oracle synthesis",
        uncertainty: "Exact emotional cost of switching tasks is unknown.",
        tags: ["focus", "planning"],
        relevance: 80,
      },
    ];
  }

  const created = [];
  for (const item of items.slice(0, 5)) {
    const row = await prisma.knowledgeItem.create({
      data: {
        userId,
        title: item.title,
        summary: item.summary,
        source: item.source ?? "Oracle",
        biasNote: item.biasNote ?? null,
        uncertainty: item.uncertainty ?? null,
        tags: item.tags ?? [],
        relevance: item.relevance ?? 50,
      },
    });
    created.push(row);
    await rememberInsight(userId, item.summary.slice(0, 200), "pattern").catch(() => {});
  }
  return created;
}

/** Assess learning topics from journal + missions. */
export async function generateLearningTopics(userId: string, locale: AppLocale = "en") {
  const count = await prisma.learningTopic.count({ where: { userId } });
  if (count >= 15) {
    return prisma.learningTopic.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  }

  const [learning, journals, missions] = await Promise.all([
    buildOperatorLearningContext(userId),
    prisma.journalEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.mission.findMany({ where: { userId, status: "ACTIVE" }, take: 5 }),
  ]);

  const system = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Identify 3-5 learning topics for this user: what they likely know, misunderstand, or are ready to learn next. Each: topic, proficiency (0-100), misconceptions (string[]), readyToLearn (boolean), nextStep (one concrete action). Return JSON: { "topics": [...] }`
  );

  const result = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Missions: ${missions.map((m) => m.title).join("; ")}\nRecent journal: ${journals.map((j) => j.content.slice(0, 120)).join(" | ")}`,
      },
    ],
  });

  type Topic = {
    topic: string;
    proficiency?: number;
    misconceptions?: string[];
    readyToLearn?: boolean;
    nextStep?: string;
  };

  let topics: Topic[] = [];
  if (result.ok) {
    const raw = JSON.parse(result.completion.choices[0]?.message?.content ?? "{}") as { topics?: Topic[] };
    topics = raw.topics ?? [];
  }

  if (topics.length === 0) {
    topics = [{ topic: "Executive function under load", proficiency: 40, readyToLearn: true, nextStep: "Complete one clarity step today" }];
  }

  const created = [];
  for (const t of topics.slice(0, 5)) {
    created.push(
      await prisma.learningTopic.create({
        data: {
          userId,
          topic: t.topic,
          proficiency: t.proficiency ?? 30,
          misconceptions: t.misconceptions ?? [],
          readyToLearn: t.readyToLearn ?? false,
          nextStep: t.nextStep ?? null,
        },
      })
    );
  }
  return created;
}

/** Run research synthesis for a query. */
export async function runResearchSynthesis(userId: string, query: string, locale: AppLocale = "en") {
  const learning = await buildOperatorLearningContext(userId);
  const memories = await getRelevantMemories(userId, 3);

  const item = await prisma.researchItem.create({
    data: { userId, query, status: "IN_PROGRESS" },
  });

  const system = buildOracleSystemPrompt(
    learning.operatorName,
    learning,
    locale,
    `Research assistant. Synthesize a balanced answer with uncertainty labels. Return JSON: { "synthesis": "...", "sources": [{ "title": "...", "note": "..." }] }. Not medical/legal/financial advice — informational only.`
  );

  const result = await createChatCompletion({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Query: ${query}\nRelevant memories: ${memories.map((m) => m.content).join("; ")}`,
      },
    ],
  });

  let synthesis = "Research pending — try again when AI is available.";
  let sources: unknown[] = [];
  if (result.ok) {
    const raw = JSON.parse(result.completion.choices[0]?.message?.content ?? "{}") as {
      synthesis?: string;
      sources?: unknown[];
    };
    synthesis = raw.synthesis ?? synthesis;
    sources = raw.sources ?? [];
  }

  return prisma.researchItem.update({
    where: { id: item.id },
    data: { synthesis, sources: sources as Prisma.InputJsonValue, status: "COMPLETE" },
  });
}

/** Seed all HDOS modules if empty. */
export async function seedHdosModules(userId: string, locale: AppLocale = "en") {
  const [k, l] = await Promise.all([
    prisma.knowledgeItem.count({ where: { userId } }),
    prisma.learningTopic.count({ where: { userId } }),
  ]);

  const results: Record<string, number> = {};
  if (k === 0) {
    const items = await generateKnowledgeItems(userId, locale);
    results.knowledge = items.length;
  }
  if (l === 0) {
    const topics = await generateLearningTopics(userId, locale);
    results.learning = topics.length;
  }

  return results;
}
