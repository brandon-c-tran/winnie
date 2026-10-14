import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.WINNIE_TEST_PORT || 4191);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // The household (and the app's care dates) run on San Francisco time.
    timezoneId: "America/Los_Angeles",
  },
  webServer: {
    command: "node scripts/dev.mjs",
    env: { WINNIE_DEV_PORT: String(port), WINNIE_DEV_CALENDAR: 'tests/fixtures/winnie-calendar.ics' },
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
  },
  projects: [
    // The household uses iPhones: WebKit at iPhone size is the main target.
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    {
      name: "chrome",
      use: {
        ...devices["Pixel 7"],
        channel: ci ? undefined : "chrome",
      },
    },
  ],
});
