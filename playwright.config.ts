import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] }
    },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
