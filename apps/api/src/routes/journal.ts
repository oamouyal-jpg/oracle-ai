import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";

export const journalRouter = Router();

journalRouter.get("/", async (req, res) => {
  const userId = await resolveUserId(req);
  const entries = await prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(entries);
});

journalRouter.post("/", async (req, res) => {
  const userId = await resolveUserId(req);
  const body = z
    .object({
      content: z.string().min(1),
      mood: z.number().min(1).max(10).optional(),
      tags: z.array(z.string()).optional(),
    })
    .parse(req.body);

  const [entry] = await Promise.all([
    prisma.journalEntry.create({
      data: {
        userId,
        content: body.content,
        mood: body.mood,
        tags: body.tags ?? [],
      },
    }),
    body.mood
      ? prisma.emotionalLog.create({
          data: {
            userId,
            level: body.mood * 10,
            label: body.mood >= 7 ? "positive" : body.mood <= 4 ? "low" : "neutral",
            notes: body.content.slice(0, 200),
          },
        })
      : Promise.resolve(null),
  ]);

  res.status(201).json(entry);
});
