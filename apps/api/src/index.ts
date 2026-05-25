import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

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
  res.json({ status: "ok", service: "oracle-api" });
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

server.listen(port, () => {
  console.log(`Oracle API running on http://localhost:${port}`);
});
