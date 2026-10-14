import { test, expect } from "@playwright/test";
import { join, code, goTimeline } from "./helpers.mjs";
test("Story has one navigation row and keeps exploration, calendar and chart evidence connected", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator("#story-tab").click();
  await expect(page.locator("#story-navigation button")).toHaveText([
    "Life",
    "Photos",
    "Places",
    "Journal",
  ]);
  await expect(page.locator(".life-timeline")).toBeVisible();
  await page.locator("#places-home").click();
  await page.locator("#photo-search").fill("beach");
  await page.locator("#photo-collection").selectOption("care-photos");
  await page.locator("#insights-tab").click();
  await expect(page.locator("#life-horizon")).toHaveValue("all");
  await expect(page.locator(".life-plot")).toHaveCount(2);
  await expect(page.locator("#story-navigation")).toBeHidden();
  await page.locator("#story-tab").click();
  await expect(page.locator("#photo-search")).toHaveValue("beach");
  await expect(page.locator("#photo-collection")).toHaveValue("care-photos");
  await goTimeline(page);
  await page.locator("#story-search").fill("pee");
  await page.locator('[data-history="lifetime"]').click();
  await expect(page.locator("#life-month")).toBeVisible();
  await expect(page.locator("#timeline-navigation")).toBeHidden();
  await page.locator("#story-back-button").click();
  await expect(page.locator("#story-search")).toHaveValue("pee");
  await page.locator("#plans-tab").click();
  await page.locator('[data-history="calendar"]').click();
  await expect(page.locator("#story-title")).toHaveText("Calendar");
  await expect(page.locator("#plans-tab")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#story-navigation")).toBeHidden();
  await page.locator("#story-back-button").click();
  await expect(page.locator("#plans-view")).toBeVisible();
  await page.locator("#insights-tab").click();
  await page.locator("#life-horizon").selectOption("6");
  await expect(page.locator(".heat-row")).toHaveCount(6);
  await page.locator("#life-rhythm").selectOption("poop");
  await expect(page.locator("#life-rhythm")).toHaveValue("poop");
  await page.locator("#insight-records").click();
  await expect(page.locator("#story-navigation")).toBeVisible();
  await expect(page.locator("#history-from")).not.toHaveValue("");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator("#insights-tab").click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const smallestAxis = await page
    .locator(".life-plot text")
    .evaluateAll((nodes) =>
      Math.min(
        ...nodes.map(
          (node) =>
            parseFloat(getComputedStyle(node).fontSize) * node.getScreenCTM().a,
        ),
      ),
    );
  expect(smallestAxis).toBeGreaterThanOrEqual(11);
  await expect(page.locator(".heat-key")).toContainText("40%+");
  await expect(page.locator(".heat-missing").first()).toHaveText(
    "No timed records",
  );
  expect(errors).toEqual([]);
});
