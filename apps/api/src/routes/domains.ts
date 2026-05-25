import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import { requestLocale } from "../lib/requestLocale.js";
import { localizeDomains } from "../lib/contentLocale.js";

export const domainsRouter = Router();

domainsRouter.get("/", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const domains = await prisma.domain.findMany({
    where: { userId },
    orderBy: { priority: "desc" },
    include: { _count: { select: { missions: true } } },
  });
  res.json(localizeDomains(domains, requestLocale(req)));
});

domainsRouter.post("/", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      name: z.string().min(1),
      slug: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      currentState: z.string().optional(),
      goals: z.array(z.string()).optional(),
    })
    .parse(req.body);

  const slug =
    body.slug ??
    body.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const domain = await prisma.domain.create({
    data: {
      userId,
      name: body.name,
      slug,
      icon: body.icon ?? "◆",
      color: body.color ?? "#6366f1",
      currentState: body.currentState,
      goals: body.goals ?? [],
    },
  });
  res.status(201).json(domain);
});

domainsRouter.patch("/:id", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      name: z.string().optional(),
      currentState: z.string().optional(),
      goals: z.array(z.string()).optional(),
      activeIssues: z.array(z.string()).optional(),
      aiObservations: z.string().optional(),
      progress: z.number().min(0).max(100).optional(),
      priority: z.number().optional(),
    })
    .parse(req.body);

  const domain = await prisma.domain.updateMany({
    where: { id: req.params.id, userId },
    data: body,
  });
  if (domain.count === 0) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.domain.findUnique({ where: { id: req.params.id } });
  res.json(updated);
});
