import { goTimeline } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";
test.use({serviceWorkers:'block'});
test.beforeEach(async ({ page }) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      headers:{'access-control-allow-origin':'*'},
      json: {
        current: { temperature_2m: 68, weather_code: 0, cloud_cover: 0 },
      },
    }),
  );
});
const feed =
  "https://calendar.google.com/calendar/ical/synthetic%40group.calendar.google.com/private-abcdef/basic.ics";
test("connect shared calendar, browse history, confirm once, refresh and disconnect", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator("#plans-tab").click();
  await page.locator('#training-visits [data-act="trainer-schedule"]').click();
  await expect(page.locator("#dialog-title")).toHaveText(
    "Connect Winnie’s calendar",
  );
  await page.getByLabel("Private calendar link").fill(feed);
  await page
    .getByRole("button", { name: "Connect calendar", exact: true })
    .click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#history-view")).toBeVisible();
  await page.locator('[data-calendar-period="past"]').click();
  await page.getByLabel("Visits", { exact: true }).selectOption("trainer");
  const row = page.locator("#calendar-results .calendar-entry");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Oct 28, 2025");
  await row.getByRole("button", { name: "Log completed visit" }).click();
  await expect(row).toContainText("View care record");
  await page.getByRole("button", { name: "Refresh now", exact: true }).click();
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("View care record");
  await page.reload();
  await goTimeline(page);
  await page.locator('[data-history="calendar"]').click();
  await page.locator('[data-calendar-period="past"]').click();
  await page.getByLabel("Visits", { exact: true }).selectOption("trainer");
  await expect(page.locator("#calendar-results")).toContainText(
    "View care record",
  );
  await page.getByRole("button", { name: "Connection", exact: true }).click();
  await expect(page.getByLabel("Private calendar link")).toHaveValue("");
  await page
    .getByRole("button", { name: "Disconnect automatic updates" })
    .click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#history-view")).toContainText("Updates paused.");
  await expect(page.locator("#calendar-results")).toContainText(
    "View care record",
  );
  expect(errors).toEqual([]);
});
test("invalid connection explains recovery; history has a useful disconnected state", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await goTimeline(page);
  await page.locator('[data-history="calendar"]').click();
  await page.getByRole("button", { name: "Connect Google Calendar" }).click();
  await page
    .getByLabel("Private calendar link")
    .fill("https://example.com/calendar");
  await page
    .getByRole("button", { name: "Connect calendar", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText(
    "Use the secret iCal address",
  );
  await expect(
    page.getByRole("button", { name: "Connect calendar", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
