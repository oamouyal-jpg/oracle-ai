import type { DetectedState, StateSnapshot, UserPattern } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { createChatCompletion } from "../lib/openai.js";
import { asStringArray } from "../lib/arrays.js";
import { localeAiInstruction, type AppLocale } from "../lib/locale.js";

const STATE_SYSTEM = `You are Oracle, a state-aware life copilot.
Your job is to help the user distinguish between facts, interpretations, emotions, and actions.
Before giving advice, detect the user's current emotional/cognitive state.

Rules:
- Never dismiss the user's feelings.
- Never say "you are irrational" or similar.
- If emotional intensity is high (7+) and fact certainty is low (5 or below), recommend delaying major decisions.
- Do not give relationship/legal/financial advice when in Threat Detection, Relationship Panic, or Financial Panic — stabilize first.
- Use calm mirror language: "Current state detected…", "Known facts…", "Possible interpretations…", "Decision risk is high…", "Next safe action…"
- Respond ONLY with valid JSON. No markdown fences.`;

export type StateAnalysisPayload = {
  detectedState: DetectedState;
  secondaryState?: DetectedState | null;
  stateConfidence: number;
  emotionalIntensity: number;
  urgency: number;
  factCertainty: number;
  decisionRisk: number;
  triggers: string[];
  knownFacts: string[];
  assumptions: string[];
  suggestedAction: string;
  delayMajorDecisions: boolean;
  delayHours?: number;
  aiReasoningSummary: string;
  currentImpulse?: string;
  stableValueConflict?: string;
  valuesAligned?: boolean;
  majorDecisionDetected?: string;
};

const VALID_STATES: DetectedState[] = [
  "CALM_REGULATED",
  "THREAT_DETECTION",
  "OVERWHELM",
  "AVOIDANCE",
  "OPPORTUNITY_MODE",
  "GRIEF",
  "SHAME_COLLAPSE",
  "ANGER_DEFENSIVENESS",
  "STRATEGIC_THINKING",
  "RELATIONSHIP_PANIC",
  "FINANCIAL_PANIC",
  "DECISION_CLARITY",
  "EXHAUSTION",
];

function parseJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function localeHint(locale: AppLocale): string {
  return localeAiInstruction(locale);
}

function clampScore(n: number, fallback = 5): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function normalizeState(raw: string | undefined): DetectedState {
  const upper = (raw ?? "").toUpperCase().replace(/[\s/-]+/g, "_");
  if (VALID_STATES.includes(upper as DetectedState)) return upper as DetectedState;
  if (/THREAT|PANIC|ABANDON/i.test(raw ?? "")) return "THREAT_DETECTION";
  if (/RELATION/i.test(raw ?? "")) return "RELATIONSHIP_PANIC";
  if (/FINANC|MONEY/i.test(raw ?? "")) return "FINANCIAL_PANIC";
  if (/OVERWHELM/i.test(raw ?? "")) return "OVERWHELM";
  if (/GRIEF|LOSS/i.test(raw ?? "")) return "GRIEF";
  if (/ANGER|DEFENS/i.test(raw ?? "")) return "ANGER_DEFENSIVENESS";
  if (/SHAME|COLLAPSE/i.test(raw ?? "")) return "SHAME_COLLAPSE";
  if (/EXHAUST/i.test(raw ?? "")) return "EXHAUSTION";
  if (/AVOID/i.test(raw ?? "")) return "AVOIDANCE";
  if (/STRATEGIC|CLARITY/i.test(raw ?? "")) return "STRATEGIC_THINKING";
  if (/OPPORTUNITY/i.test(raw ?? "")) return "OPPORTUNITY_MODE";
  return "CALM_REGULATED";
}

function offlineStateAnalysis(rawInput: string): StateAnalysisPayload {
  const lower = rawInput.toLowerCase();
  const relationshipPanic =
    /not answering|isn't answering|end it|break up|leave (her|him)|over this|hiding something|with someone else|silent|ignoring me/i.test(
      rawInput
    );
  const financialPanic = /money|debt|bankrupt|can't afford|financial|broke|sell everything/i.test(lower);
  const overwhelm = /overwhelm|too much|can't handle|everything at once|drowning/i.test(lower);
  const ending = /ready to end|i'm done|give up on|walk away/i.test(lower);

  let detectedState: DetectedState = "CALM_REGULATED";
  if (relationshipPanic) detectedState = ending ? "RELATIONSHIP_PANIC" : "THREAT_DETECTION";
  else if (financialPanic) detectedState = "FINANCIAL_PANIC";
  else if (overwhelm) detectedState = "OVERWHELM";

  const emotionalIntensity = relationshipPanic || financialPanic ? 8 : overwhelm ? 7 : 4;
  const factCertainty = relationshipPanic ? 3 : 5;
  const decisionRisk = relationshipPanic && ending ? 9 : emotionalIntensity >= 7 && factCertainty <= 4 ? 8 : 4;
  const delayMajorDecisions = decisionRisk >= 7 && factCertainty <= 5;

  const knownFacts: string[] = [];
  const assumptions: string[] = [];
  if (relationshipPanic) {
    knownFacts.push("You feel unheard or ignored right now.");
    if (/not answering|isn't answering|silent/i.test(rawInput)) {
      knownFacts.push("The other person has not responded yet.");
    }
    if (/previous|history|before/i.test(lower)) {
      knownFacts.push("There is previous history of uncertainty in this relationship.");
    }
    if (/hiding|someone else|affair|cheat/i.test(lower)) {
      assumptions.push("They may be hiding something or with someone else.");
    }
    if (/unsafe|danger/i.test(lower)) {
      assumptions.push("This silence means the relationship is unsafe.");
    }
  } else {
    knownFacts.push("You shared what is happening in your own words.");
  }

  const triggers: string[] = [];
  if (/silent|not answering|ignoring/i.test(lower)) triggers.push("Silence or non-response");
  if (/uncertain|uncertainty|don't know/i.test(lower)) triggers.push("Uncertainty");
  if (/abandon|left|alone/i.test(lower)) triggers.push("Abandonment fear");

  let suggestedAction =
    "Take three slow breaths. Write one sentence describing only what you know for certain — not what you fear.";
  let aiReasoningSummary =
    "Emotional load is moderate. Oracle recommends separating facts from story before acting.";

  if (relationshipPanic && delayMajorDecisions) {
    suggestedAction =
      "Do not send another message tonight. Wait until tomorrow and ask one clear transparency question.";
    aiReasoningSummary =
      "Current state detected: Threat Detection / Relationship Panic. Emotional intensity is high and fact certainty is low. Major relationship decisions should wait at least 24 hours.";
  } else if (financialPanic) {
    suggestedAction = "Do not make irreversible financial moves today. Write the numbers you know on paper first.";
    aiReasoningSummary =
      "Financial Panic detected. Urgency is high but clarity on facts may be incomplete — stabilize before committing.";
  } else if (overwhelm) {
    suggestedAction = "Pick one thing that would make tomorrow 10% easier. Do only that tonight.";
    aiReasoningSummary = "Overwhelm detected. Reduce scope before planning next moves.";
  }

  return {
    detectedState,
    secondaryState: relationshipPanic && detectedState === "RELATIONSHIP_PANIC" ? "THREAT_DETECTION" : null,
    stateConfidence: 72,
    emotionalIntensity,
    urgency: relationshipPanic ? 8 : 5,
    factCertainty,
    decisionRisk,
    triggers,
    knownFacts,
    assumptions,
    suggestedAction,
    delayMajorDecisions,
    delayHours: delayMajorDecisions ? 24 : undefined,
    aiReasoningSummary,
    currentImpulse: ending ? "End the relationship or withdraw now." : undefined,
    stableValueConflict: ending
      ? "Your stable value may be connection and repair — not permanent exit under uncertainty."
      : undefined,
    valuesAligned: ending ? false : undefined,
    majorDecisionDetected: ending ? "Ending or permanently withdrawing from the relationship" : undefined,
  };
}

async function callStateJson<T>(
  userPrompt: string,
  locale: AppLocale
): Promise<{ data: T | null; source: "openai" | "offline" }> {
  const result = await createChatCompletion({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${STATE_SYSTEM}\n${localeHint(locale)}` },
      { role: "user", content: userPrompt },
    ],
  });

  if (!result.ok) return { data: null, source: "offline" };

  const text = result.completion.choices[0]?.message?.content ?? "";
  return { data: parseJson<T>(text), source: "openai" };
}

function overlapScore(a: string[], b: string[]): number {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  let hits = 0;
  for (const item of a) {
    const lower = item.toLowerCase();
    if ([...setB].some((x) => lower.includes(x) || x.includes(lower))) hits++;
  }
  return hits;
}

async function findMatchingPattern(
  userId: string,
  analysis: StateAnalysisPayload
): Promise<UserPattern | null> {
  const patterns = await prisma.userPattern.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  let best: UserPattern | null = null;
  let bestScore = 0;

  for (const pattern of patterns) {
    const related = asStringArray(pattern.relatedStates);
    const triggers = asStringArray(pattern.knownTriggers);
    let score = 0;
    if (related.includes(analysis.detectedState)) score += 3;
    if (analysis.secondaryState && related.includes(analysis.secondaryState)) score += 2;
    score += overlapScore(analysis.triggers, triggers) * 2;
    score += overlapScore(asStringArray(pattern.typicalThoughts), analysis.assumptions);
    if (score > bestScore) {
      bestScore = score;
      best = pattern;
    }
  }

  return bestScore >= 3 ? best : null;
}

async function inferPatternFromHistory(
  userId: string,
  analysis: StateAnalysisPayload
): Promise<UserPattern | null> {
  const recent = await prisma.stateSnapshot.findMany({
    where: {
      userId,
      detectedState: { in: [analysis.detectedState, analysis.secondaryState].filter(Boolean) as DetectedState[] },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  if (recent.length < 2) return null;

  const allTriggers = new Set<string>();
  const allAssumptions = new Set<string>();
  for (const snap of recent) {
    asStringArray(snap.triggers).forEach((t) => allTriggers.add(t));
    asStringArray(snap.assumptions).forEach((a) => allAssumptions.add(a));
  }
  analysis.triggers.forEach((t) => allTriggers.add(t));
  analysis.assumptions.forEach((a) => allAssumptions.add(a));

  const patternName = stateLabel(analysis.detectedState);
  const description = `Recurring ${patternName.toLowerCase()} when ${[...allTriggers].slice(0, 2).join(" or ") || "similar triggers"} appear.`;

  return prisma.userPattern.create({
    data: {
      userId,
      patternName,
      description,
      knownTriggers: [...allTriggers].slice(0, 8),
      typicalThoughts: [...allAssumptions].slice(0, 6),
      typicalBehaviors: ["Urge to act immediately", "Withdraw or end things", "Send repeated messages"],
      helpfulInterventions: [
        "Pause before major decisions",
        "Separate facts from assumptions",
        analysis.suggestedAction,
      ],
      warningSigns: analysis.triggers.slice(0, 5),
      relatedStates: [analysis.detectedState, ...(analysis.secondaryState ? [analysis.secondaryState] : [])],
      occurrenceCount: recent.length + 1,
    },
  });
}

export function stateLabel(state: DetectedState): string {
  return state
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function isHighRiskState(state: DetectedState): boolean {
  return [
    "THREAT_DETECTION",
    "RELATIONSHIP_PANIC",
    "FINANCIAL_PANIC",
    "ANGER_DEFENSIVENESS",
    "SHAME_COLLAPSE",
    "OVERWHELM",
  ].includes(state);
}

function normalizeAnalysis(raw: Partial<StateAnalysisPayload>, rawInput: string): StateAnalysisPayload {
  const offline = offlineStateAnalysis(rawInput);
  const emotionalIntensity = clampScore(raw.emotionalIntensity ?? offline.emotionalIntensity);
  const factCertainty = clampScore(raw.factCertainty ?? offline.factCertainty);
  const decisionRisk = clampScore(raw.decisionRisk ?? offline.decisionRisk);
  const delayMajorDecisions =
    raw.delayMajorDecisions ??
    ((decisionRisk >= 7 && factCertainty <= 5) ||
      (emotionalIntensity >= 7 && factCertainty <= 4));

  return {
    detectedState: normalizeState(raw.detectedState ?? offline.detectedState),
    secondaryState: raw.secondaryState ? normalizeState(String(raw.secondaryState)) : offline.secondaryState,
    stateConfidence: clampScore(raw.stateConfidence ?? offline.stateConfidence, 70),
    emotionalIntensity,
    urgency: clampScore(raw.urgency ?? offline.urgency),
    factCertainty,
    decisionRisk,
    triggers: raw.triggers?.length ? raw.triggers : offline.triggers,
    knownFacts: raw.knownFacts?.length ? raw.knownFacts : offline.knownFacts,
    assumptions: raw.assumptions?.length ? raw.assumptions : offline.assumptions,
    suggestedAction: raw.suggestedAction?.trim() || offline.suggestedAction,
    delayMajorDecisions,
    delayHours: delayMajorDecisions ? raw.delayHours ?? 24 : undefined,
    aiReasoningSummary: raw.aiReasoningSummary?.trim() || offline.aiReasoningSummary,
    currentImpulse: raw.currentImpulse ?? offline.currentImpulse,
    stableValueConflict: raw.stableValueConflict ?? offline.stableValueConflict,
    valuesAligned: raw.valuesAligned ?? offline.valuesAligned,
    majorDecisionDetected: raw.majorDecisionDetected ?? offline.majorDecisionDetected,
  };
}

export type StateDetectionResult = {
  snapshot: ReturnType<typeof formatSnapshot>;
  pattern: ReturnType<typeof formatPattern> | null;
  stableValues: { id: string; valueName: string; description: string | null; examples: string[] }[];
  source: "openai" | "offline";
};

export function formatSnapshot(
  snap: StateSnapshot & { matchedPattern?: UserPattern | null }
) {
  return {
    id: snap.id,
    issueId: snap.issueId,
    journalEntryId: snap.journalEntryId,
    rawInput: snap.rawInput,
    detectedState: snap.detectedState,
    detectedStateLabel: stateLabel(snap.detectedState),
    secondaryState: snap.secondaryState,
    secondaryStateLabel: snap.secondaryState ? stateLabel(snap.secondaryState) : null,
    stateConfidence: snap.stateConfidence,
    emotionalIntensity: snap.emotionalIntensity,
    urgency: snap.urgency,
    factCertainty: snap.factCertainty,
    decisionRisk: snap.decisionRisk,
    triggers: asStringArray(snap.triggers),
    knownFacts: asStringArray(snap.knownFacts),
    assumptions: asStringArray(snap.assumptions),
    suggestedAction: snap.suggestedAction,
    delayMajorDecisions: snap.delayMajorDecisions,
    delayHours: snap.delayHours,
    aiReasoningSummary: snap.aiReasoningSummary,
    currentImpulse: snap.currentImpulse,
    stableValueConflict: snap.stableValueConflict,
    valuesAligned: snap.valuesAligned,
    matchedPatternId: snap.matchedPatternId,
    matchedPattern: snap.matchedPattern ? formatPattern(snap.matchedPattern) : null,
    createdAt: snap.createdAt,
  };
}

export function formatPattern(pattern: UserPattern) {
  return {
    id: pattern.id,
    patternName: pattern.patternName,
    description: pattern.description,
    knownTriggers: asStringArray(pattern.knownTriggers),
    typicalThoughts: asStringArray(pattern.typicalThoughts),
    typicalBehaviors: asStringArray(pattern.typicalBehaviors),
    helpfulInterventions: asStringArray(pattern.helpfulInterventions),
    warningSigns: asStringArray(pattern.warningSigns),
    relatedStates: asStringArray(pattern.relatedStates),
    occurrenceCount: pattern.occurrenceCount,
    updatedAt: pattern.updatedAt,
  };
}

export async function runStateDetection(
  userId: string,
  rawInput: string,
  locale: AppLocale,
  options?: { issueId?: string; journalEntryId?: string }
): Promise<StateDetectionResult> {
  const [history, stableValues, patterns] = await Promise.all([
    prisma.stateSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.stableValue.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.userPattern.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 8 }),
  ]);

  const historyBlock = history
    .map(
      (h) =>
        `- ${stateLabel(h.detectedState)} (intensity ${h.emotionalIntensity}, certainty ${h.factCertainty}): ${h.rawInput.slice(0, 120)}`
    )
    .join("\n");

  const valuesBlock = stableValues
    .map((v) => `- ${v.valueName}: ${v.description ?? ""} Examples: ${asStringArray(v.examples).join("; ")}`)
    .join("\n");

  const patternsBlock = patterns
    .map(
      (p) =>
        `- ${p.patternName}: triggers ${asStringArray(p.knownTriggers).join(", ")}; helped by ${asStringArray(p.helpfulInterventions).slice(0, 2).join(", ")}`
    )
    .join("\n");

  const prompt = `Analyze the user's current state. Return JSON:
{
  "detectedState": one of ${VALID_STATES.join(" | ")},
  "secondaryState": optional second state or null,
  "stateConfidence": 1-100,
  "emotionalIntensity": 1-10,
  "urgency": 1-10,
  "factCertainty": 1-10 (how much is verified fact vs story),
  "decisionRisk": 1-10 (risk of acting impulsively on major decisions now),
  "triggers": ["..."],
  "knownFacts": ["only verifiable or user-stated facts"],
  "assumptions": ["interpretations not yet proven"],
  "suggestedAction": "ONE stabilizing next safe action only",
  "delayMajorDecisions": boolean,
  "delayHours": number if delaying (usually 24),
  "aiReasoningSummary": "2-4 sentences using mirror language",
  "currentImpulse": "what the user wants to do right now",
  "stableValueConflict": "which stable value may conflict with the impulse, if any",
  "valuesAligned": boolean,
  "majorDecisionDetected": "describe major decision impulse if any, else null"
}

Recent history:
${historyBlock || "None yet."}

Known stable values:
${valuesBlock || "None recorded yet — infer likely values from context."}

Known patterns:
${patternsBlock || "None yet."}

User input now:
${rawInput}`;

  type RawPayload = Partial<StateAnalysisPayload> & { detectedState?: string };
  const { data, source } = await callStateJson<RawPayload>(prompt, locale);
  const analysis = normalizeAnalysis(data ?? {}, rawInput);

  let matchedPattern = await findMatchingPattern(userId, analysis);
  if (!matchedPattern && history.filter((h) => h.detectedState === analysis.detectedState).length >= 2) {
    matchedPattern = await inferPatternFromHistory(userId, analysis);
  } else if (matchedPattern) {
    await prisma.userPattern.update({
      where: { id: matchedPattern.id },
      data: { occurrenceCount: { increment: 1 }, updatedAt: new Date() },
    });
  }

  const snapshot = await prisma.stateSnapshot.create({
    data: {
      userId,
      issueId: options?.issueId,
      journalEntryId: options?.journalEntryId,
      rawInput,
      detectedState: analysis.detectedState,
      secondaryState: analysis.secondaryState ?? undefined,
      stateConfidence: analysis.stateConfidence,
      emotionalIntensity: analysis.emotionalIntensity,
      urgency: analysis.urgency,
      factCertainty: analysis.factCertainty,
      decisionRisk: analysis.decisionRisk,
      triggers: analysis.triggers,
      knownFacts: analysis.knownFacts,
      assumptions: analysis.assumptions,
      suggestedAction: analysis.suggestedAction,
      delayMajorDecisions: analysis.delayMajorDecisions,
      delayHours: analysis.delayHours,
      aiReasoningSummary: analysis.aiReasoningSummary,
      currentImpulse: analysis.currentImpulse,
      stableValueConflict: analysis.stableValueConflict,
      valuesAligned: analysis.valuesAligned,
      matchedPatternId: matchedPattern?.id,
    },
    include: { matchedPattern: true },
  });

  if (analysis.majorDecisionDetected && analysis.decisionRisk >= 6) {
    await prisma.majorDecisionLog.create({
      data: {
        userId,
        issueId: options?.issueId,
        decisionText: analysis.majorDecisionDetected,
        stateSnapshotId: snapshot.id,
        riskLevel: analysis.decisionRisk,
        oracleRecommendation: analysis.delayMajorDecisions
          ? `Delay this decision for ${analysis.delayHours ?? 24} hours. ${analysis.suggestedAction}`
          : analysis.suggestedAction,
      },
    });
  }

  return {
    snapshot: formatSnapshot(snapshot),
    pattern: matchedPattern ? formatPattern(matchedPattern) : null,
    stableValues: stableValues.map((v) => ({
      id: v.id,
      valueName: v.valueName,
      description: v.description,
      examples: asStringArray(v.examples),
    })),
    source,
  };
}

export async function getLatestSnapshot(userId: string) {
  const snap = await prisma.stateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { matchedPattern: true },
  });
  return snap ? formatSnapshot(snap) : null;
}

export async function listSnapshots(userId: string, limit = 20) {
  const snaps = await prisma.stateSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { matchedPattern: true },
  });
  return snaps.map(formatSnapshot);
}
