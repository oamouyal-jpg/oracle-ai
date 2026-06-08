import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(webRoot, ".next/standalone/apps/web");
const server = path.join(serverDir, "server.js");

if (!fs.existsSync(server)) {
  console.error("[oracle-web] Missing", server, "— run npm run build first");
  process.exit(1);
}

const port = process.env.PORT || "3000";
const child = spawn(process.execPath, [server], {
  cwd: serverDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: "0.0.0.0",
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=460",
  },
});

child.on("exit", (code) => process.exit(code ?? 1));
