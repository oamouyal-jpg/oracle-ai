import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

/** Load apps/api/.env regardless of process cwd (monorepo root vs apps/api). */
export function loadEnv(): void {
  if (loaded) return;
  const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  dotenv.config({ path: path.join(apiRoot, ".env") });
  loaded = true;
}
