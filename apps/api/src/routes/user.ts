import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveUserId } from "../lib/user.js";
import {
  consolidateStrategicProfile,
  parseStrategicProfile,
} from "../lib/operatorLearning.js";

export const userRouter = Router();

userRouter.get("/profile", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, strategicProfile: true, energyLevel: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const profile = parseStrategicProfile(user.strategicProfile);
  const memoryCount = await prisma.aIMemory.count({ where: { userId } });

  res.json({
    name: user.name ?? "",
    email: user.email,
    energyLevel: user.energyLevel,
    strategicProfile: profile,
    memoryCount,
  });
});

userRouter.patch("/profile", async (req, res) => {
  const userId = await resolveUserId(req.headers["x-user-id"] as string);
  const body = z
    .object({
      name: z.string().min(1).max(80).optional(),
      energyLevel: z.number().min(1).max(100).optional(),
    })
    .parse(req.body);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.energyLevel !== undefined ? { energyLevel: body.energyLevel } : {}),
    },
    select: { name: true, email: true, strategicProfile: true, energyLevel: true },
  });

  const profile = await consolidateStrategicProfile(userId);

  res.json({
    name: user.name ?? "",
    email: user.email,
    energyLevel: user.energyLevel,
    strategicProfile: profile,
  });
});
