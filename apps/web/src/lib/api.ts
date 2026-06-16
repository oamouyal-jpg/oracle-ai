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
  weekPlanTasks: () => fetchApi<ClarityTasksBundle[]>("/tasks/clarity"),
  clarityTasks: () => fetchApi<ClarityTasksBundle[]>("/tasks/clarity"),
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
  dailyOracleToday: () => fetchApi<DailyOracleLine>("/daily-oracle/today"),
  regenerateDailyOracle: () =>
    fetchApi<DailyOracleLine>("/daily-oracle/regenerate", { method: "POST" }),
  debriefQuestions: () => fetchApi<DebriefQuestions>("/debrief/questions"),
  debriefToday: () => fetchApi<NightDebrief | null>("/debrief/today"),
  saveDebriefAnswer: (payload: { key: string; answer: string; finalize?: boolean }) =>
    fetchApi<NightDebrief>("/debrief/answer", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
  journal: () => fetchApi<JournalEntryWithState[]>("/journal"),
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
  taskReminders: () => fetchApi<TaskReminderPayload[]>("/notifications/task-reminders"),
  ackTaskReminder: (taskId: string) =>
    fetchApi<{ ok: boolean }>(`/notifications/task-reminders/${taskId}/ack`, {
      method: "POST",
    }),
  clarityIssues: (status?: string) =>
    fetchApi<ClarityIssueListItem[]>(`/clarity${status ? `?status=${status}` : ""}`),
  clarityIssue: (id: string) => fetchApi<ClarityIssueDetail>(`/clarity/${id}`),
  createClarityIssue: (data: CreateClarityIssueInput) =>
    fetchApi<ClarityIssueDetail & { aiSource?: string }>("/clarity", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createWeekPlan: (rawInput: string) =>
    fetchApi<ClarityIssueDetail & { aiSource?: string }>("/clarity/week", {
      method: "POST",
      body: JSON.stringify({ rawInput }),
    }),
  clarifyIssue: (id: string, answer: string) =>
    fetchApi<ClarityIssueDetail & { done?: boolean }>(`/clarity/${id}/clarify`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),
  retryClarityPlan: (id: string) =>
    fetchApi<ClarityIssueDetail & { aiSource?: string }>(`/clarity/${id}/retry-plan`, {
      method: "POST",
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
    fetchApi<ClarityIssueDetail & { aiSource?: string; stateDetection?: StateDetectionResult }>(
      `/clarity/${issueId}/check-in`,
      {
        method: "POST",
        body: JSON.stringify({ rawText }),
      }
    ),
  clarityAdvice: (
    issueId: string,
    payload: { question: string; stepId?: string; taskId?: string; missionId?: string }
  ) =>
    fetchApi<{ advice: string; scopeLabel: string; source: "openai" | "offline" }>(
      `/clarity/${issueId}/advice`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
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
  stateSnapshots: (limit?: number) =>
    fetchApi<StateSnapshot[]>(`/state-check${limit ? `?limit=${limit}` : ""}`),
  latestStateSnapshot: () =>
    fetchApi<{ snapshot: StateSnapshot | null }>("/state-check/latest"),
  runStateCheck: (data: { rawInput: string; issueId?: string }) =>
    fetchApi<StateDetectionResult>("/state-check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  statePatterns: () => fetchApi<UserPattern[]>("/state-check/patterns"),
  stableValues: () => fetchApi<StableValue[]>("/state-check/values"),
  createStableValue: (data: { valueName: string; description?: string; examples?: string[] }) =>
    fetchApi<StableValue>("/state-check/values", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  innerCheckIn: (rawInput: string) =>
    fetchApi<InnerSessionResult>("/inner-os/check-in", {
      method: "POST",
      body: JSON.stringify({ rawInput }),
    }),
  innerReflect: (sessionId: string, answers: string[]) =>
    fetchApi<InnerSessionResult>(`/inner-os/sessions/${sessionId}/reflect`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  innerActionDone: (sessionId: string, done: boolean) =>
    fetchApi<InnerSessionResult>(`/inner-os/sessions/${sessionId}/action`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    }),
  innerSessions: (limit?: number) =>
    fetchApi<InnerSession[]>(`/inner-os/sessions${limit ? `?limit=${limit}` : ""}`),
  innerGrowth: () => fetchApi<InnerGrowth>("/inner-os/growth"),
  innerValues: () => fetchApi<StableValue[]>("/inner-os/values"),
  createInnerValue: (data: { valueName: string; description?: string; examples?: string[] }) =>
    fetchApi<StableValue>("/inner-os/values", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteInnerValue: (id: string) =>
    fetchApi<void>(`/inner-os/values/${id}`, { method: "DELETE" }),
  createJournal: (data: { content: string; mood?: number; tags?: string[]; runStateDetection?: boolean }) =>
    fetchApi<{ entry: JournalEntry; stateDetection: StateDetectionResult | null }>("/journal", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  agentActions: (issueId?: string) =>
    fetchApi<AgentAction[]>(`/agent-actions${issueId ? `?issueId=${issueId}` : ""}`),
  agentIntegrations: () => fetchApi<AgentIntegrationInfo[]>("/agent-actions/integrations"),
  detectAgentAction: (issueId: string, stepId: string) =>
    fetchApi<AgentAction>("/agent-actions/detect", {
      method: "POST",
      body: JSON.stringify({ issueId, stepId }),
    }),
  approveAgentAction: (id: string, overrideState?: boolean) =>
    fetchApi<AgentAction>(`/agent-actions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ overrideState }),
    }),
  executeAgentAction: (id: string, forceSend?: boolean) =>
    fetchApi<{ action: AgentAction; blocked?: boolean; stateMessage?: string | null }>(
      `/agent-actions/${id}/execute`,
      { method: "POST", body: JSON.stringify({ forceSend }) }
    ),
  cancelAgentAction: (id: string) =>
    fetchApi<AgentAction>(`/agent-actions/${id}/cancel`, { method: "POST" }),
  followThroughAgentAction: (
    id: string,
    data: { eventType: string; eventSummary: string }
  ) =>
    fetchApi<{ nextActionHint: string; markComplete: boolean }>(
      `/agent-actions/${id}/follow-through`,
      { method: "POST", body: JSON.stringify(data) }
    ),
};

export interface MorningNotificationPayload {
  title: string;
  body: string;
  url: string;
  dailyOracleLine: string;
  dailyOracleSubline: string | null;
  topTaskTitle: string | null;
  focusRecommendation: string | null;
}

export interface TaskReminderPayload {
  taskId: string;
  title: string;
  body: string;
  url: string;
  dueDate: string | null;
  scheduledAt: string | null;
  reminderAt: string;
  overdue: boolean;
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
  dueDate?: string | null;
  scheduledAt?: string | null;
  reminderAt?: string | null;
}

export interface ClarityTasksBundle {
  issueId: string;
  issueTitle: string;
  mode: ClarityIssueMode;
  weekStartDate: string | null;
  tasks: ClarityLinkedTask[];
}

/** @deprecated use ClarityTasksBundle */
export type WeekPlanTasksBundle = ClarityTasksBundle;

export interface ClarityLinkedTask extends Task {
  stepId: string;
  stepStatus: string;
  isCurrent: boolean;
}

/** @deprecated use ClarityLinkedTask */
export type WeekPlanTask = ClarityLinkedTask;

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

export interface DailyOracleLine {
  id: string;
  date: string;
  line: string;
  subline: string | null;
  source: "openai" | "offline";
}

export interface NightDebrief {
  responses?: Record<string, string>;
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
    domainHealth: { name: string; slug: string; progress: number; color: string }[];
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

export type ClarityIssueMode = "SINGLE_ISSUE" | "WEEK_PLAN";

export interface ClarityIssueListItem {
  id: string;
  title: string;
  mode?: ClarityIssueMode;
  status: ClarityIssueStatus;
  aiSummary: string | null;
  northStar: string | null;
  currentStepTitle: string | null;
  stepCount: number;
  taskProgress?: { done: number; total: number; hasTasks: boolean };
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
  dueAt?: string | null;
  linkedTaskId?: string | null;
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
  mode?: ClarityIssueMode;
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
  weekStartDate?: string | null;
  todayStepCount?: number;
  overdueCount?: number;
  stepsByDay?: Record<
    string,
    { id: string; title: string; status: string; dueAt: string | null }[]
  >;
  latestState?: StateSnapshotSummary | null;
  agentActions?: AgentAction[];
  currentAgentAction?: AgentAction | null;
  promotedMission?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type DetectedState =
  | "CALM_REGULATED"
  | "THREAT_DETECTION"
  | "OVERWHELM"
  | "AVOIDANCE"
  | "OPPORTUNITY_MODE"
  | "GRIEF"
  | "SHAME_COLLAPSE"
  | "ANGER_DEFENSIVENESS"
  | "STRATEGIC_THINKING"
  | "RELATIONSHIP_PANIC"
  | "FINANCIAL_PANIC"
  | "DECISION_CLARITY"
  | "EXHAUSTION";

export interface StateSnapshotSummary {
  id?: string;
  detectedState: DetectedState;
  detectedStateLabel?: string;
  emotionalIntensity: number;
  decisionRisk: number;
  delayMajorDecisions: boolean;
  suggestedAction: string;
  aiReasoningSummary?: string | null;
}

export interface StateSnapshot extends StateSnapshotSummary {
  issueId: string | null;
  journalEntryId: string | null;
  rawInput: string;
  secondaryState: DetectedState | null;
  secondaryStateLabel: string | null;
  stateConfidence: number;
  urgency: number;
  factCertainty: number;
  triggers: string[];
  knownFacts: string[];
  assumptions: string[];
  delayHours: number | null;
  currentImpulse: string | null;
  stableValueConflict: string | null;
  valuesAligned: boolean | null;
  matchedPatternId: string | null;
  matchedPattern: UserPattern | null;
  createdAt: string;
}

export interface UserPattern {
  id: string;
  patternName: string;
  description: string | null;
  knownTriggers: string[];
  typicalThoughts: string[];
  typicalBehaviors: string[];
  helpfulInterventions: string[];
  warningSigns: string[];
  relatedStates: string[];
  occurrenceCount: number;
  updatedAt: string;
}

export interface StableValue {
  id: string;
  valueName: string;
  description: string | null;
  examples: string[];
  updatedAt?: string;
}

export interface StateDetectionResult {
  snapshot: StateSnapshot;
  pattern: UserPattern | null;
  stableValues: StableValue[];
  source: "openai" | "offline";
}

export type InnerDriver =
  | "CALM_CENTERED"
  | "FEAR"
  | "ANXIETY"
  | "SHAME"
  | "LONELINESS"
  | "APPROVAL"
  | "ADDICTION"
  | "AVOIDANCE"
  | "ANGER"
  | "JEALOUSY"
  | "CONTROL"
  | "DEPENDENCY"
  | "IMPULSIVITY"
  | "CONDITIONING";

export type InnerPatternCategory =
  | "GROUNDED"
  | "FEAR_BASED"
  | "AVOIDANCE"
  | "RELATIONSHIP"
  | "ADDICTION"
  | "SELF_SABOTAGE"
  | "CONTROL";

export interface InnerSession {
  id: string;
  rawInput: string;
  primaryDriver: InnerDriver;
  primaryDriverLabel: string;
  secondaryDriver: InnerDriver | null;
  secondaryDriverLabel: string | null;
  patternCategory: InnerPatternCategory;
  patternCategoryLabel: string;
  patternName: string | null;
  possibleRootCause: string | null;
  triggers: string[];
  feelings: string[];
  facts: string[];
  reflectionQuestions: string[];
  reflectionAnswers: string[];
  reflectionInsight: string | null;
  currentStateTraits: string[];
  healthyStateTraits: string[];
  comparisonSummary: string | null;
  freedomAction: string | null;
  freedomActionDone: boolean;
  oracleReflection: string | null;
  professionalSupportSuggested: boolean;
  intensity: number;
  scores: {
    emotionalRegulation: number;
    selfAwareness: number;
    healthyDecision: number;
    freedom: number;
  };
  createdAt: string;
}

export interface InnerSessionResult {
  session: InnerSession;
  source: "openai" | "offline";
}

export interface InnerGrowthScore {
  value: number;
  trend: number;
}

export interface InnerGrowth {
  totalSessions: number;
  topDrivers: { driver: InnerDriver; label: string; count: number }[];
  repeatingPatterns: { category: InnerPatternCategory; label: string; count: number }[];
  scores: {
    emotionalRegulation: InnerGrowthScore;
    selfAwareness: InnerGrowthScore;
    healthyDecision: InnerGrowthScore;
    freedom: InnerGrowthScore;
  };
  consistencyScore: number;
  trends: string[];
}

export interface JournalEntryWithState extends JournalEntry {
  latestState?: {
    detectedState: DetectedState;
    emotionalIntensity: number;
    decisionRisk: number;
    delayMajorDecisions: boolean;
  } | null;
}

export type ActionClassification = "HUMAN_ACTION" | "AGENT_ACTION" | "HYBRID_ACTION";

export type ActionExecutionStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AgentAction {
  id: string;
  issueId: string | null;
  actionStepId: string | null;
  classification: ActionClassification;
  actionType: string;
  actionTitle: string;
  actionDescription: string;
  status: ActionExecutionStatus;
  requiresApproval: boolean;
  capabilities: string[];
  payload: Record<string, unknown>;
  executionResult: Record<string, unknown>;
  stateBlocked: boolean;
  stateOverride: boolean;
  integrationTool: string | null;
  createdAt: string;
  executedAt: string | null;
  updatedAt: string;
}

export interface AgentIntegrationInfo {
  id: string;
  category: string;
  label: string;
  configured: boolean;
  available: boolean;
}
