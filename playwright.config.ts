import { defineConfig } from "@playwright/test";

// Runs against the production build using the system Edge (chromium channel),
// so no browser download is needed. `npm run build` must have run first.
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    headless: true,
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
