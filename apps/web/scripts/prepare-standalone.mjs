import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(webRoot, ".next/standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[prepare-standalone] skip missing: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function findServerDir() {
  const candidates = [
    path.join(standaloneRoot, "apps/web"),
    standaloneRoot,
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "server.js"))) return dir;
  }
  return null;
}

if (!fs.existsSync(standaloneRoot)) {
  console.error("[prepare-standalone] No .next/standalone — run next build first");
  process.exit(1);
}

const serverDir = findServerDir();
if (!serverDir) {
  console.error("[prepare-standalone] Could not find server.js in standalone output");
  process.exit(1);
}

copyDir(path.join(webRoot, ".next/static"), path.join(serverDir, ".next/static"));
copyDir(path.join(webRoot, "public"), path.join(serverDir, "public"));

console.log(`[prepare-standalone] ready: ${serverDir}`);
console.log(`[prepare-standalone] static -> ${path.join(serverDir, ".next/static")}`);
