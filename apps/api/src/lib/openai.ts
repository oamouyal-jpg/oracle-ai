import OpenAI from "openai";
import { loadEnv } from "./env.js";

let client: OpenAI | null = null;
let invalidKeyWarned = false;
let lastFallbackReason: string | null = null;

function normalizeKey(raw: string | undefined): string {
  return (raw ?? "").replace(/^\uFEFF/, "").trim().replace(/^["']|["']$/g, "");
}

function readApiKeyFromEnv(): string {
  loadEnv();
  const candidates = [
    process.env.OPENAI_API_KEY,
    process.env.OPEN_API_KEY,
    process.env.OPENAI_KEY,
  ];
  for (const c of candidates) {
    const normalized = normalizeKey(c);
    if (normalized) return normalized;
  }
  return "";
}

function getApiKey(): string | null {
  const key = readApiKeyFromEnv();
  if (!key) {
    lastFallbackReason = "OPENAI_API_KEY is not set on the API service";
    return null;
  }
  if (key.length < 20) {
    lastFallbackReason = "OPENAI_API_KEY is too short or still a placeholder (use a real sk-… key on oracle-api)";
    return null;
  }
  if (/^(your[-_]?key|sk-\.{3}|xxx|placeholder|test)/i.test(key)) {
    lastFallbackReason = "OPENAI_API_KEY looks like a placeholder — replace with your real key";
    return null;
  }
  lastFallbackReason = null;
  return key;
}

export function hasOpenAIKey(): boolean {
  return getApiKey() !== null;
}

export function getOpenAIStatus(): {
  configured: boolean;
  mode: "openai" | "offline";
  reason?: string;
  keyLength?: number;
  keyPrefix?: string;
} {
  const key = getApiKey();
  if (key) {
    return {
      configured: true,
      mode: "openai",
      keyLength: key.length,
      keyPrefix: key.slice(0, 7),
    };
  }
  const raw = readApiKeyFromEnv();
  return {
    configured: false,
    mode: "offline",
    reason: lastFallbackReason ?? "OpenAI not configured",
    keyLength: raw.length || undefined,
    keyPrefix: raw ? raw.slice(0, 7) : undefined,
  };
}

function getClient(): OpenAI | null {
  const key = getApiKey();
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

export function isOpenAIAuthError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 401 || err.status === 403;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /incorrect api key|invalid_api_key|authentication|api key/i.test(msg);
}

export type ChatCompletionResult =
  | { ok: true; completion: OpenAI.Chat.Completions.ChatCompletion }
  | { ok: false; reason: string };

const JSON_MODE_HINT = "Respond with valid json only.";

/** OpenAI requires the word "json" in messages when using response_format json_object. */
function ensureJsonHintInMessages(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const hasJson = messages.some(
    (m) => typeof m.content === "string" && /json/i.test(m.content)
  );
  if (hasJson) return messages;

  const copy = [...messages];
  const systemIdx = copy.findIndex((m) => m.role === "system");
  if (systemIdx >= 0 && typeof copy[systemIdx]!.content === "string") {
    copy[systemIdx] = {
      ...copy[systemIdx]!,
      content: `${copy[systemIdx]!.content as string}\n${JSON_MODE_HINT}`,
    };
  } else {
    copy.unshift({ role: "system", content: JSON_MODE_HINT });
  }
  return copy;
}

/** Returns failure reason when no key, invalid key, or auth failure — caller should use offline fallback. */
export async function createChatCompletion(
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletionResult> {
  const openai = getClient();
  if (!openai) {
    return { ok: false, reason: lastFallbackReason ?? "OpenAI client not configured" };
  }

  const requestParams =
    params.response_format?.type === "json_object"
      ? { ...params, messages: ensureJsonHintInMessages(params.messages) }
      : params;

  try {
    const completion = await openai.chat.completions.create(requestParams);
    return { ok: true, completion };
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401 || err.status === 403) {
        const reason = "OPENAI_API_KEY rejected by OpenAI (invalid or expired)";
        lastFallbackReason = reason;
        if (!invalidKeyWarned) {
          console.warn(`[Oracle] ${reason} — using offline strategist`);
          invalidKeyWarned = true;
        }
        return { ok: false, reason };
      }
      if (err.status === 400) {
        console.warn(`[Oracle] OpenAI 400 — falling back offline: ${err.message}`);
        return { ok: false, reason: err.message };
      }
    }
    throw err;
  }
}
