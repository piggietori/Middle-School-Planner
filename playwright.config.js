import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {baseURL: "http://localhost:5174", trace: "retain-on-failure"},
  projects: [
    {name: "desktop", use: {...devices["Desktop Chrome"]}},
    {name: "phone", use: {...devices["Pixel 7"]}},
  ],
  webServer: {command: "node scripts/serve.js 5174", url: "http://localhost:5174", reuseExistingServer: !process.env.CI},
});
