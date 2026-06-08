import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(webRoot, ".next/standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function findServer() {
  const candidates = [
    path.join(standaloneRoot, "apps/web/server.js"),
    path.join(standaloneRoot, "server.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

if (!fs.existsSync(standaloneRoot)) {
  console.error("[oracle-web] Missing .next/standalone — run next build with output:standalone first");
  process.exit(1);
}

const server = findServer();
if (!server) {
  console.error("[oracle-web] Could not find standalone server.js");
  process.exit(1);
}

const serverDir = path.dirname(server);

// Static assets must live beside server.js (monorepo: apps/web/.next/static).
copyDir(path.join(webRoot, ".next/static"), path.join(serverDir, ".next/static"));
copyDir(path.join(webRoot, "public"), path.join(serverDir, "public"));

console.log(`[oracle-web] server: ${server}`);
console.log(`[oracle-web] static: ${path.join(serverDir, ".next/static")}`);

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
