import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test.local" });
loadEnv({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.spec.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});
