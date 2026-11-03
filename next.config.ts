import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules; keep them out of the server bundle.
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
