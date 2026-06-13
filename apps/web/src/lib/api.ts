import { getStoredLocale } from "@/lib/i18n/messages";
import { getSessionToken } from "@/lib/session";
import type { Session, SessionUser } from "@/lib/session";

const API_OFFLINE_MSG =
  "Oracle API is not running on port 4000. In PowerShell run: npm.cmd run dev:api (or npm.cmd run dev for both servers), then refresh.";

function getApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const publicBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    if (publicBase) return `${publicBase}/api${path}`;
    // Production (Render): browser → same-origin Next proxy → INTERNAL_API_URL
    if (process.env.NODE_ENV === "production") return `/api${path}`;
    return `http://127.0.0.1:4000/api${path}`;
  }
  const base = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";
  return `${base}/api${path}`;
}

function parseApiError(status: number, text: string): string {
  let message = text.trim() || `API error ${status}`;
  try {
    const j = JSON.parse(text) as { error?: string; details?: unknown };
    if (typeof j.error === "string") message = j.error;
    if (j.details && status === 400) {
      message = `${message}: ${JSON.stringify(j.details)}`;
    }
  } catch {
    if (message.length > 400) message = message.slice(0, 400) + "…";
  }
  if (/^internal server error$/i.test(message)) {
    return API_OFFLINE_MSG;
  }
  return message;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-locale": getStoredLocale(),
  };
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders(),
        ...options?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(API_OFFLINE_MSG);
  }
  if (!res.ok) {
    throw new Error(parseApiError(res.status, await res.text()));
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        "API returned HTML instead of JSON. Set NEXT_PUBLIC_API_URL on oracle-ai to your oracle-api URL."
      );
    }
    throw new Error(parseApiError(res.status, text));
  }
}

/** Ping Express — use on pages to show API-offline banner */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const url =
      typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/health`
          : process.env.NODE_ENV === "production"
            ? "/api/dashboard"
            : "http://127.0.0.1:4000/health"
        : `${(process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "")}/health`;
    const res = await fetch(url, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  register: (name: string, email: string, password: string) =>
    fetchApi<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    fetchApi<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  authMe: () => fetchApi<SessionUser>("/auth/me"),
  onboardingQuestions: () =>
    fetchApi<{ complete: boolean; questions: OnboardingQuestion[] }>("/auth/onboarding/questions"),
  completeOnboarding: (answers: Record<string, string>) =>
    fetchApi<{ ok: boolean; onboardingComplete: boolean }>("/auth/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  dashboard: () => fetchApi<DashboardData>("/dashboard"),
  domains: () => fetchApi<Domain[]>("/domains"),
  missions: (status?: string) =>
    fetchApi<Mission[]>(`/missions${status ? `?status=${status}` : ""}`),
  mission: (id: string) => fetchApi<MissionDetail>(`/missions/${id}`),
  tasks: (params?: { status?: string; missionId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.missionId) q.set("missionId", params.missionId);
    return fetchApi<Task[]>(`/tasks?${q}`);
  },
  focusTasks: () => fetchApi<FocusTasksResult>("/tasks/focus"),
  refreshFocusTasks: () =>
    fetchApi<FocusTasksResult>("/tasks/focus/refresh", { method: "POST" }),
  submitTaskFollowUp: (id: string, progress: string) =>
    fetchApi<TaskFollowUpResult>(`/tasks/${id}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ progress }),
    }),
  createTask: (data: Partial<Task>) =>
    fetchApi<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    fetchApi<UpdateTaskResult>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  briefingToday: () => fetchApi<Briefing>("/briefing/today"),
  regenerateBriefing: () =>
    fetchApi<Briefing>("/briefing/regenerate", { method: "POST" }),
  debriefQuestions: () => fetchApi<DebriefQuestions>("/debrief/questions"),
  debriefToday: () => fetchApi<NightDebrief | null>("/debrief/today"),
  submitDebrief: (responses: Record<string, string>) =>
    fetchApi<NightDebrief>("/debrief/submit", {
      method: "POST",
      body: JSON.stringify({ responses }),
    }),
  chat: (message: string) =>
    fetchApi<{ reply: string; source?: "openai" | "offline"; offlineReason?: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  chatStatus: () =>
    fetchApi<{ configured: boolean; mode: "openai" | "offline"; reason?: string; keyLength?: number }>(
      "/ai/status"
    ),
  clearChatHistory: () => fetchApi<void>("/ai/chat/history", { method: "DELETE" }),
  chatHistory: () => fetchApi<ChatMessage[]>("/ai/chat/history"),
  prioritize: () => fetchApi<PrioritizeResult>("/ai/prioritize", { method: "POST" }),
  insights: () => fetchApi<Insights>("/ai/insights"),
  journal: () => fetchApi<JournalEntry[]>("/journal"),
  createJournal: (data: { content: string; mood?: number; tags?: string[] }) =>
    fetchApi<JournalEntry>("/journal", { method: "POST", body: JSON.stringify(data) }),
  createMission: (data: CreateMissionInput) =>
    fetchApi<Mission>("/missions", { method: "POST", body: JSON.stringify(data) }),
  updateMission: (id: string, data: Partial<CreateMissionInput>) =>
    fetchApi<Mission>(`/missions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMission: (id: string) =>
    fetchApi<void>(`/missions/${id}`, { method: "DELETE" }),
  missionTracker: (id: string) => fetchApi<MissionTrackerDetail>(`/missions/${id}`),
  postMissionUpdate: (id: string, content: string, updateType?: "DAILY" | "WEEKLY") =>
    fetchApi<{ update: MissionUpdate; analysis: unknown }>(`/missions/${id}/updates`, {
      method: "POST",
      body: JSON.stringify({ content, updateType }),
    }),
  missionAiReview: (id: string) =>
    fetchApi<{ mission: MissionTrackerDetail; review: AiMissionReview }>(
      `/missions/${id}/ai-review`,
      { method: "POST" }
    ),
  tradingQuestions: () =>
    fetchApi<{ questions: string[]; rules: string[] }>("/missions/trading/questions"),
  tradingToday: (missionId: string) =>
    fetchApi<TradingDailyLog | null>(`/missions/${missionId}/trading/today`),
  submitTradingDaily: (missionId: string, data: TradingDailyInput) =>
    fetchApi<TradingDailyResult>(`/missions/${missionId}/trading/daily`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  tradingWeeklyReport: (missionId: string) =>
    fetchApi<WeeklyTradingReport>(`/missions/${missionId}/trading/weekly`),
  alignment: () => fetchApi<AlignmentDashboard>("/alignment"),
  recalculateAlignment: () =>
    fetchApi<AlignmentDashboard>("/alignment/recalculate", { method: "POST" }),
  submitReflection: (content: string, mood?: number, energy?: number) =>
    fetchApi<{ reflection: Reflection; alignment: AlignmentSnapshot }>("/alignment/reflect", {
      method: "POST",
      body: JSON.stringify({ content, mood, energy }),
    }),
  reflections: () => fetchApi<Reflection[]>("/alignment/reflections"),
  userProfile: () => fetchApi<UserProfile>("/user/profile"),
  updateProfile: (data: { name?: string; energyLevel?: number }) =>
    fetchApi<UserProfile>("/user/profile", { method: "PATCH", body: JSON.stringify(data) }),
  morningNotification: () => fetchApi<MorningNotificationPayload>("/notifications/morning"),
  clarityIssues: (status?: string) =>
    fetchApi<ClarityIssueListItem[]>(`/clarity${status ? `?status=${status}` : ""}`),
  clarityIssue: (id: string) => fetchApi<ClarityIssueDetail>(`/clarity/${id}`),
  createClarityIssue: (data: CreateClarityIssueInput) =>
    fetchApi<ClarityIssueDetail & { aiSource?: string }>("/clarity", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  clarifyIssue: (id: string, answer: string) =>
    fetchApi<ClarityIssueDetail & { done?: boolean }>(`/clarity/${id}/clarify`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),
  completeClarityStep: (issueId: string, stepId: string) =>
    fetchApi<ClarityIssueDetail>(`/clarity/${issueId}/steps/${stepId}/complete`, {
      method: "POST",
    }),
  skipClarityStep: (issueId: string, stepId: string) =>
    fetchApi<ClarityIssueDetail>(`/clarity/${issueId}/steps/${stepId}/skip`, {
      method: "POST",
    }),
  clarityCheckIn: (issueId: string, rawText: string) =>
    fetchApi<ClarityIssueDetail & { aiSource?: string }>(`/clarity/${issueId}/check-in`, {
      method: "POST",
      body: JSON.stringify({ rawText }),
    }),
  promoteClarityIssue: (issueId: string) =>
    fetchApi<ClarityIssueDetail & { missionId: string }>(`/clarity/${issueId}/promote`, {
      method: "POST",
    }),
  updateClarityIssue: (id: string, data: { status?: string; title?: string }) =>
    fetchApi<ClarityIssueDetail>(`/clarity/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteClarityIssue: (id: string) =>
    fetchApi<void>(`/clarity/${id}`, { method: "DELETE" }),
};

export interface MorningNotificationPayload {
  title: string;
  body: string;
  url: string;
  topTaskTitle: string | null;
  focusRecommendation: string | null;
}

export interface Domain {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  currentState: string | null;
  progress: number;
  activeIssues: string[];
  goals: string[];
  aiObservations: string | null;
}

export interface Mission {
  id: string;
  title: string;
  purpose: string | null;
  whyItMatters?: string | null;
  desiredOutcome?: string | null;
  status: string;
  missionType?: "GENERAL" | "TRADING";
  priorityScore: number;
  progress: number;
  momentumScore?: number;
  stabilityScore?: number;
  resistanceScore?: number;
  blockers: string[];
  risks?: string[];
  nextActions?: string[];
  emotionalResistance?: number;
  aiNotes?: string | null;
  aiStrategy?: string | null;
  weeklyReview?: string | null;
  tradingConfig?: { rules?: string[]; maxContracts?: number; instruments?: string[] } | null;
  lastAiReviewAt?: string | null;
  domain?: { name: string; slug?: string; color: string };
  _count?: { tasks: number; updates?: number; tradingLogs?: number };
}

export interface MissionDetail extends Mission {
  tasks: Task[];
}

export interface MissionTrackerDetail extends Mission {
  tasks: Task[];
  updates: MissionUpdate[];
  tradingLogs: TradingDailyLog[];
}

export interface MissionUpdate {
  id: string;
  updateType: string;
  content: string;
  progressSnapshot: number | null;
  aiAnalysis: string | null;
  createdAt: string;
}

export interface TradingDailyLog {
  id: string;
  responses: Record<string, string>;
  emotionalBefore: number | null;
  emotionalAfter: number | null;
  followedRules: boolean | null;
  tradedFromCalm: boolean | null;
  disciplineScore: number | null;
  executionScore: number | null;
  riskControlScore: number | null;
  aiDailyReport: string | null;
  revengeTrade: boolean;
  date: string;
}

export interface CreateMissionInput {
  title: string;
  purpose?: string;
  whyItMatters?: string;
  desiredOutcome?: string;
  missionType?: "GENERAL" | "TRADING";
  blockers?: string[];
  risks?: string[];
  nextActions?: string[];
  emotionalResistance?: number;
  priorityScore?: number;
}

export interface AiMissionReview {
  aiNotes: string;
  aiStrategy: string;
  progressRecommendation: number;
  nextActions: string[];
  weeklyReview: string;
  riskWarnings: string[];
  encouragement: string;
}

export interface TradingDailyInput {
  responses: Record<string, string>;
  emotionalBefore?: number;
  emotionalAfter?: number;
  followedRules?: boolean;
  tradedFromCalm?: boolean;
  setupQuality?: number;
  instrument?: string;
  contractsUsed?: number;
  ruleViolations?: string[];
  revengeTrade?: boolean;
  hesitation?: boolean;
  overtraded?: boolean;
  respectedStop?: boolean;
  dailyRisk?: string;
  maxLoss?: string;
  lessonsLearned?: string;
}

export interface TradingDailyResult {
  log: TradingDailyLog;
  aiDailyReport?: string;
  disciplineScore?: number;
  executionScore?: number;
  riskControlScore?: number;
  shouldPauseTrading?: boolean;
  warnings?: string[];
  nextImprovementTarget?: string;
}

export interface WeeklyTradingReport {
  report: string;
  logsCount: number;
  avgDiscipline?: number;
  nextWeekFocus?: string;
}

export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIAL"
  | "SKIPPED"
  | "DELAYED"
  | "RESCHEDULED"
  | "CANCELLED";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  estimatedEffort?: number;
  emotionalDifficulty?: number;
  aiGenerated?: boolean;
  completionNote?: string | null;
  mission?: { id: string; title: string };
  missionId?: string | null;
}

export interface FocusFollowUp {
  taskId: string;
  question: string;
  priorNote: string | null;
  lastOracleReply: string | null;
}

export interface FocusTasksResult {
  tasks: Task[];
  created: number;
  overview: string;
  queueSize: number;
  followUps: FocusFollowUp[];
  recentFollowUps: FocusFollowUp[];
  prioritization: { recommendation: string; insights: string[] };
}

export interface TaskFollowUpResult {
  task: Task;
  acknowledgment: string;
  suggestedStatus: TaskStatus | null;
  replenished: { tasks: Task[]; created: number } | null;
}

export interface UpdateTaskResult {
  task: Task;
  replenished: { tasks: Task[]; created: number } | null;
}

export interface AlignmentAiPlan {
  personalAnalysis: string;
  progressActions: string[];
  selfDevelopment: string[];
  structuralActions: string[];
}

export interface AlignmentSnapshot {
  alignmentScore: number;
  driftScore: number;
  overloadScore: number;
  meaningfulProgress: number;
  executionConsistency: number;
  emotionalStability: number;
  frictionAreas: string[];
  patterns: string[];
  recommendations: string[];
  aiAssessment: string | null;
  aiPlan?: AlignmentAiPlan | null;
}

export interface Reflection {
  id: string;
  content: string;
  mood: number | null;
  energy: number | null;
  actualProgress: number | null;
  emotionalState: string | null;
  resistance: number | null;
  momentumSignal: number | null;
  avoidance: string | null;
  alignmentSignal: number | null;
  aiAnalysis: string | null;
  createdAt: string;
}

export interface AlignmentDashboard {
  alignment: AlignmentSnapshot;
  missions: {
    id: string;
    title: string;
    progress: number;
    momentumScore: number;
    stabilityScore: number;
    resistanceScore: number;
    domain?: string;
    color?: string;
  }[];
  momentumTrend: Record<
    string,
    { date: string; momentum: number; stability: number; resistance: number }[]
  >;
  reflections: Reflection[];
  patterns: string[];
  frictionInsights: string[];
  emotionalTrend: { level: number; date: string }[];
  isLifeMovingForward: boolean;
}

export interface Briefing {
  topPriorities: string[];
  emotionalObservation: string;
  focusRecommendation: string;
  reminders: string[];
  missionProgress: string;
  strategicGuidance: string;
  fullContent?: string;
}

export interface NightDebrief {
  focusScore: number | null;
  emotionalScore: number | null;
  executionScore: number | null;
  alignmentScore: number | null;
  energyScore: number | null;
  aiAssessment: string | null;
  behavioralNotes: string[];
  tomorrowPlan: TomorrowPlan | null;
  patternDetected: string | null;
}

export interface TomorrowPlan {
  topPriorities: string[];
  missionCritical: string[];
  emotionalWarnings: string[];
  focusRecommendation: string;
  recoverySuggestions: string[];
  executionStrategy: string;
}

export interface DebriefQuestions {
  execution: string[];
  emotional: string[];
  relationships: string[];
  health: string[];
  awareness: string[];
}

export interface DashboardData {
  stats: {
    activeMissions: number;
    pendingTasks: number;
    completedToday: number;
    momentum: number;
    alignmentScore: number | null;
    isLifeMovingForward: boolean | null;
    energyLevel: number;
  };
  alignment?: AlignmentSnapshot | null;
  alignmentRecommendations?: string[];
  patterns?: string[];
  frictionInsights?: string[];
  domains: Domain[];
  missions: Mission[];
  topTasks: Task[];
  briefing: Briefing | null;
  lastDebrief: NightDebrief | null;
  stressAreas: string[];
  emotionalTrend?: { level: number; date: string }[];
  lifeMap: {
    missionStatus: {
      id: string;
      title: string;
      progress: number;
      momentum?: number;
      stability?: number;
      resistance?: number;
      priority: number;
      domain?: string;
    }[];
    domainHealth: { name: string; progress: number; color: string }[];
  };
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface PrioritizeResult {
  recommendation: string;
  orderedTaskIds: string[];
  insights: string[];
}

export interface Insights {
  operatorName?: string;
  proactivePrompts: string[];
  memories: string[];
  patterns?: string[];
  recentScores: Record<string, number> | null;
}

export interface OnboardingQuestion {
  id: string;
  question: string;
  placeholder: string;
}

export interface UserProfile {
  name: string;
  email: string;
  energyLevel: number;
  strategicProfile: {
    patterns: string[];
    strengths: string[];
    triggers: string[];
    learnedTraits: string[];
  };
  memoryCount?: number;
  onboardingComplete?: boolean;
}

export interface JournalEntry {
  id: string;
  content: string;
  mood: number | null;
  tags: string[];
  createdAt: string;
}

export type ClarityIssueStatus =
  | "INTAKE"
  | "CLARIFYING"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED";

export type ClarityStepStatus =
  | "LOCKED"
  | "CURRENT"
  | "PENDING"
  | "COMPLETED"
  | "SKIPPED"
  | "BLOCKED";

export interface CreateClarityIssueInput {
  rawInput: string;
  emotionalIntensity?: number;
  urgency?: number;
  importance?: number;
}

export interface ClarityIssueListItem {
  id: string;
  title: string;
  status: ClarityIssueStatus;
  aiSummary: string | null;
  northStar: string | null;
  currentStepTitle: string | null;
  stepCount: number;
  promotedMissionId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ClarityOutcome {
  id: string;
  northStarStatement: string;
  desiredLifeState: string | null;
  primaryGoal: string | null;
  secondaryGoals: string[];
  successDefinition: string | null;
  avoidDefinition: string | null;
}

export interface ClarityConstraint {
  id: string;
  type: string;
  description: string;
  severity: number;
}

export interface ClarityStep {
  id: string;
  title: string;
  description: string | null;
  whyThisNow: string | null;
  prepareNotes: string | null;
  priorityOrder: number;
  status: ClarityStepStatus;
  difficulty: number;
  expectedOutcome: string | null;
  completionCriteria: string | null;
  completedAt: string | null;
}

export interface ClarityMessage {
  id: string;
  role: string;
  kind: string;
  content: string;
  createdAt: string;
}

export interface ClarityCheckIn {
  id: string;
  rawText: string;
  aiSummary: string | null;
  suggestedNextAction: string | null;
  createdAt: string;
}

export interface ClarityIssueDetail {
  id: string;
  title: string;
  rawInput: string;
  aiSummary: string | null;
  status: ClarityIssueStatus;
  emotionalIntensity: number | null;
  urgency: number | null;
  importance: number | null;
  pendingQuestions: string[];
  clarifyingAnswers: string[];
  promotedMissionId: string | null;
  outcome: ClarityOutcome | null;
  constraints: ClarityConstraint[];
  steps: ClarityStep[];
  messages: ClarityMessage[];
  checkIns: ClarityCheckIn[];
  currentStep: ClarityStep | null;
  promotedMission?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}
