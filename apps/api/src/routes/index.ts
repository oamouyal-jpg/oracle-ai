import { Router } from "express";
import { domainsRouter } from "./domains.js";
import { missionsRouter } from "./missions.js";
import { tasksRouter } from "./tasks.js";
import { aiRouter } from "./ai.js";
import { briefingRouter } from "./briefing.js";
import { debriefRouter } from "./debrief.js";
import { journalRouter } from "./journal.js";
import { dashboardRouter } from "./dashboard.js";
import { alignmentRouter } from "./alignment.js";

export const apiRouter = Router();

apiRouter.use("/domains", domainsRouter);
apiRouter.use("/missions", missionsRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/briefing", briefingRouter);
apiRouter.use("/debrief", debriefRouter);
apiRouter.use("/journal", journalRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/alignment", alignmentRouter);
