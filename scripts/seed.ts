import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

// Usage: pnpm seed
// Resets the local database and loads the synthetic October month through the pipeline
// (replay mode by default, so no API key is needed). The dataset itself is committed;
// `pnpm dataset` regenerates it.

const ROOT = join(import.meta.dirname, "..");
if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));

const { getEnv } = await import("@/config/env");
const env = getEnv();
const dbPath = join(ROOT, env.DATABASE_PATH);
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });

const { runSampleMonth } = await import("@/server/months");
const runId = await runSampleMonth();
console.log(`Loaded the October sample month (${env.MODE} mode).`);
console.log("Start the app with `pnpm dev`, then open:");
console.log(`  http://localhost:3000/review/${runId}`);
