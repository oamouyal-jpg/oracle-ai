import type { Request } from "express";
import { prisma } from "./prisma.js";
import { extractBearerToken, verifySessionToken } from "./auth.js";
import { HttpError } from "./errors.js";

const DEV_EMAIL = "operator@oracle.local";

type HeaderSource = Request | { headers: Record<string, string | string[] | undefined> };

function getHeaders(source: HeaderSource): Record<string, string | string[] | undefined> {
  return source.headers;
}

async function getOrCreateDevUser(): Promise<string> {
  let user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        name: "Operator",
        onboardingComplete: true,
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

function allowDevFallback(): boolean {
  return (
    process.env.ALLOW_DEV_USER === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_USER !== "false")
  );
}

/** Resolve authenticated user id from Bearer session token. No anonymous access in production. */
export async function resolveUserId(source: HeaderSource): Promise<string> {
  const headers = getHeaders(source);
  const token = extractBearerToken(headers);
  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) return user.id;
    }
  }

  // Legacy header — dev only
  const legacy = headers["x-user-id"];
  const legacyId = Array.isArray(legacy) ? legacy[0] : legacy;
  if (legacyId && allowDevFallback()) {
    const user = await prisma.user.findUnique({ where: { id: legacyId } });
    if (user) return user.id;
  }

  if (allowDevFallback()) {
    return getOrCreateDevUser();
  }

  throw new HttpError(401, "Unauthorized — sign in required");
}

/** @deprecated Pass full req to resolveUserId */
export async function resolveUserIdFromHeader(headerUserId?: string): Promise<string> {
  if (headerUserId && allowDevFallback()) {
    const user = await prisma.user.findUnique({ where: { id: headerUserId } });
    if (user) return user.id;
  }
  if (allowDevFallback()) return getOrCreateDevUser();
  throw new HttpError(401, "Unauthorized — sign in required");
}
