/**
 * Oracle Constitution — compact principles injected into every AI system prompt.
 * Full manifesto: docs/VISION.md · Module map: docs/MODULES.md
 *
 * Design for Version 100. Implement the smallest step that grows without redesign.
 */

export const ORACLE_CONSTITUTION_COMPACT = `ORACLE — Human Development Operating System

North star: maximise long-term human flourishing, freedom, wisdom, and development — not engagement, entertainment, or dependency.

First principles — increase freedom from: ignorance, manipulation, unhealthy habits, fear, unnecessary suffering, misinformation, emotional reactivity, intellectual stagnation, addiction. Increase freedom to: think, create, love, understand reality, become who the user is capable of becoming.

User model: build a living cognitive model (values, goals, patterns, blind spots, aspirations). Never judge — understand.

Attention is sacred: no infinite scroll, no addictive mechanics, no engagement optimisation, no emotional manipulation. Every interruption must justify itself.

Psychology & ethics: reflect, never diagnose. Frame observations as possibilities. Never shame. Never manipulate. Encourage awareness and growth. The paradox of success: the more Oracle succeeds, the less the user should need Oracle.

Decision support: combine values, knowledge, consequences, risk, emotion, and long-term goals. Present possibilities — never decide for the user. Increase clarity.

Agents & modules share one memory and one evolving understanding of the user. No module exists in isolation.`;

/** Module identifiers aligned with docs/MODULES.md */
export type OracleModuleId =
  | "memory"
  | "psychology"
  | "decision"
  | "planning"
  | "purpose"
  | "reflection"
  | "vision"
  | "communication"
  | "ethics"
  | "knowledge"
  | "learning"
  | "relationship"
  | "health"
  | "finance"
  | "creativity"
  | "research";

export type ModuleStatus = "live" | "partial" | "planned";

export const ORACLE_MODULES: Record<
  OracleModuleId,
  { name: string; status: ModuleStatus; servicePaths: string[] }
> = {
  memory: {
    name: "Memory Engine",
    status: "partial",
    servicePaths: ["lib/operatorLearning.ts", "services/alignmentEngine.ts"],
  },
  psychology: {
    name: "Psychology Engine",
    status: "partial",
    servicePaths: ["services/innerOsEngine.ts", "services/stateDetectionEngine.ts"],
  },
  decision: {
    name: "Decision Engine",
    status: "partial",
    servicePaths: ["services/clarityEngine.ts"],
  },
  planning: {
    name: "Planning Engine",
    status: "partial",
    servicePaths: ["services/focusTasks.ts", "services/weekPlanEngine.ts", "services/proactiveEngine.ts"],
  },
  purpose: {
    name: "Purpose Engine",
    status: "partial",
    servicePaths: ["services/alignmentEngine.ts", "services/dailyOracleLine.ts"],
  },
  reflection: {
    name: "Reflection Engine",
    status: "partial",
    servicePaths: ["services/debriefEngine.ts", "services/innerOsEngine.ts"],
  },
  vision: {
    name: "Vision Engine",
    status: "partial",
    servicePaths: ["routes/dashboard.ts", "routes/briefing.ts"],
  },
  communication: {
    name: "Communication Engine",
    status: "partial",
    servicePaths: ["services/actionExecutionEngine.ts"],
  },
  ethics: {
    name: "Ethics Engine",
    status: "partial",
    servicePaths: ["services/innerOsEngine.ts"],
  },
  knowledge: { name: "Knowledge Engine", status: "planned", servicePaths: [] },
  learning: { name: "Learning Engine", status: "planned", servicePaths: [] },
  relationship: { name: "Relationship Engine", status: "planned", servicePaths: [] },
  health: { name: "Health Engine", status: "planned", servicePaths: [] },
  finance: { name: "Finance Engine", status: "planned", servicePaths: [] },
  creativity: { name: "Creativity Engine", status: "planned", servicePaths: [] },
  research: { name: "Research Engine", status: "planned", servicePaths: ["services/actionExecutionEngine.ts"] },
};

/** Append constitution to any module-specific system prompt. */
export function withOracleConstitution(modulePrompt: string): string {
  return `${ORACLE_CONSTITUTION_COMPACT}\n\n---\n\n${modulePrompt}`;
}
