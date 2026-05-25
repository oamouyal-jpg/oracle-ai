import { unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const dir = dirname(fileURLToPath(import.meta.url));
const dbPath = join(dir, "dev.db");

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("Removed dev.db");
}

execSync("npx prisma db push", { stdio: "inherit", cwd: join(dir, "..") });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: join(dir, "..") });
console.log("Database reset and seeded.");
