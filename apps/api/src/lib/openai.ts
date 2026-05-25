import OpenAI from "openai";

let client: OpenAI | null = null;
let invalidKeyWarned = false;

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (key.length < 20) return null;
  if (/^(your[-_]?key|sk-\.{3}|xxx|placeholder|test)/i.test(key)) return null;
  return key;
}

export function hasOpenAIKey(): boolean {
  return getApiKey() !== null;
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

/** Returns null when no key, invalid key, or auth failure — caller should use mock fallback. */
export async function createChatCompletion(
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.Completions.ChatCompletion | null> {
  const openai = getClient();
  if (!openai) return null;

  try {
    return await openai.chat.completions.create(params);
  } catch (err) {
    if (isOpenAIAuthError(err)) {
      if (!invalidKeyWarned) {
        console.warn(
          "[Oracle] OPENAI_API_KEY is invalid or unauthorized — using offline mock AI. Fix or remove OPENAI_API_KEY in apps/api/.env"
        );
        invalidKeyWarned = true;
      }
      return null;
    }
    throw err;
  }
}
