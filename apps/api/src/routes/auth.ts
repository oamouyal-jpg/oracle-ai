import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
} from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { bootstrapNewUser } from "../services/userBootstrap.js";
import {
  completeOnboarding,
  generateOnboardingQuestions,
} from "../services/onboarding.js";

export const authRouter = Router();

function sessionResponse(user: {
  id: string;
  email: string;
  name: string | null;
  onboardingComplete: boolean;
}) {
  return {
    token: createSessionToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      onboardingComplete: user.onboardingComplete,
    },
  };
}

authRouter.post("/register", async (req, res) => {
  const body = z
    .object({
      email: z.string().email().max(120),
      password: z.string().min(8).max(128),
      name: z.string().min(1).max(80),
    })
    .parse(req.body);

  const email = body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(body.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: body.name.trim(),
          onboardingComplete: false,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: body.name.trim(),
          strategicProfile: {
            patterns: [],
            strengths: [],
            triggers: [],
            learnedTraits: [],
          },
        },
      });

  await bootstrapNewUser(user.id);
  res.status(201).json(sessionResponse(user));
});

authRouter.post("/login", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1).max(128),
    })
    .parse(req.body);

  const email = body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    throw new HttpError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  await bootstrapNewUser(user.id);
  res.json(sessionResponse(user));
});

authRouter.get("/me", async (req, res) => {
  const userId = await resolveUserId(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      onboardingComplete: true,
      energyLevel: true,
    },
  });
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    onboardingComplete: user.onboardingComplete,
    energyLevel: user.energyLevel,
  });
});

authRouter.get("/onboarding/questions", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, onboardingComplete: true },
  });
  if (!user) throw new HttpError(401, "Unauthorized");
  if (user.onboardingComplete) {
    res.json({ complete: true, questions: [] });
    return;
  }

  const questions = await generateOnboardingQuestions(user.name ?? "Operator", locale);
  res.json({ complete: false, questions });
});

authRouter.post("/onboarding/complete", async (req, res) => {
  const userId = await resolveUserId(req);
  const locale = requestLocale(req);
  const body = z
    .object({
      answers: z.record(z.string(), z.string()),
    })
    .parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, onboardingComplete: true },
  });
  if (!user) throw new HttpError(401, "Unauthorized");
  if (user.onboardingComplete) {
    res.json({ ok: true, onboardingComplete: true });
    return;
  }

  const answered = Object.values(body.answers).filter((a) => a.trim().length >= 2);
  if (answered.length < 3) {
    throw new HttpError(400, "Please answer at least 3 questions");
  }

  await completeOnboarding(userId, user.name ?? "Operator", body.answers, locale);
  res.json({ ok: true, onboardingComplete: true });
});
