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
import { userRouter } from "./user.js";
import { notificationsRouter } from "./notifications.js";
import { authRouter } from "./auth.js";
import { clarityRouter } from "./clarity.js";
import { stateCheckRouter } from "./stateCheck.js";
import { agentActionsRouter } from "./agentActions.js";
import { dailyOracleRouter } from "./dailyOracle.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);

apiRouter.use("/clarity", clarityRouter);
apiRouter.use("/state-check", stateCheckRouter);
apiRouter.use("/agent-actions", agentActionsRouter);
apiRouter.use("/daily-oracle", dailyOracleRouter);

apiRouter.use("/domains", domainsRouter);
apiRouter.use("/missions", missionsRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/briefing", briefingRouter);
apiRouter.use("/debrief", debriefRouter);
apiRouter.use("/journal", journalRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/alignment", alignmentRouter);
apiRouter.use("/user", userRouter);
apiRouter.use("/notifications", notificationsRouter);
