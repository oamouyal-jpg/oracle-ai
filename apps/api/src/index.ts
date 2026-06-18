import { loadEnv } from "./lib/env.js";
loadEnv();
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getOpenAIStatus } from "./lib/openai.js";
import { runScheduler } from "./services/proactiveEngine.js";
import { pushConfigured } from "./lib/push.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

const allowedOrigins = (
  process.env.CORS_ORIGIN ??
  "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
).split(",");

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "oracle-api", ai: getOpenAIStatus() });
});

app.use("/api", apiRouter);

app.use(errorHandler);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "connected", message: "Oracle strategic channel active" }));

  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: "pulse",
          timestamp: new Date().toISOString(),
        })
      );
    }
  }, 30000);

  ws.on("close", () => clearInterval(interval));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Oracle API running on http://0.0.0.0:${port}`);
});

// Proactive scheduler: nudges users toward priorities via web push, even when
// the app is closed. Runs in-process every minute. Disable with SCHEDULER_ENABLED=false
// (e.g. when driving delivery from an external Render Cron Job hitting /run-scheduler).
if (process.env.SCHEDULER_ENABLED !== "false") {
  const tick = () => {
    runScheduler().catch((err) =>
      console.warn("[Oracle] scheduler tick failed:", (err as Error)?.message)
    );
  };
  setTimeout(tick, 15000);
  setInterval(tick, 60000);
  console.log(`[Oracle] proactive scheduler enabled (web push configured: ${pushConfigured()})`);
}
