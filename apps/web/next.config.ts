import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Smaller runtime footprint on Render (avoids loading full monorepo node_modules).
  output: "standalone",
  outputFileTracingRoot: path.join(webRoot, "../.."),
};

export default nextConfig;
