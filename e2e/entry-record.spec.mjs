import { goTimeline } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

test("concise records preserve full notes, place, tags and separate care attribution", async ({
  page,
}, info) => {
  const errors = await join(page, code(info), "kim");
  const note =
    "After the afternoon walk. " +
    "An extra detail from the original record. ".repeat(8);
  await page.evaluate(async (note) => {
    const { sync } = await import("/app/services.js?v=4.22");
    await sync.enqueue("create", crypto.randomUUID(), {
      type: "poop",
      time: Date.now() - 60000,
      tags: ["firm", "outdoors"],
      location: "San Carlos",
      who: "trainer",
      note,
    });
  }, note);
  await goTimeline(page);
  await page.locator("#history-type").selectOption("poop");
  const row = page.locator("#story-items .feed-entry").first();
  await expect(row).toContainText("Kim");
  await expect(row).toContainText("Firm stool");
  await row.locator(".entry").click();
  await expect(page.locator(".detail-author")).toContainText("Logged by Kim");
  await expect(page.locator(".detail-facts")).toContainText("trainer");
  await expect(page.locator(".detail-facts")).toContainText("outdoors");
  await expect(page.locator(".detail-place")).toContainText("San Carlos");
  await expect(page.locator(".detail-notes")).toHaveText(note.trim());
  expect(errors).toEqual([]);
});

test("entry dates stay inside narrow sheets and retain edited times", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.getByRole("button", { name: "Record bath" }).click();
  await page.getByRole("button", { name: "Save bath", exact: true }).click();
  await page.locator("#timeline .entry").first().click();
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  for (const width of [320, 390, 560]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page
      .locator('#event-form [name="time"]')
      .evaluate((input) => {
        const r = input.getBoundingClientRect(),
          label = input.parentElement.getBoundingClientRect();
        return {
          contained: r.left >= label.left && r.right <= label.right + 1,
          overflow:
            document.querySelector("#dialog-content").scrollWidth >
            document.querySelector("#dialog-content").clientWidth,
        };
      });
    expect(bounds).toEqual({ contained: true, overflow: false });
  }
  await page.locator('#event-form [name="time"]').fill("2026-10-11T13:43");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const saved = await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.22");
    return sync.view().events.find((e) => e.careTitle === "Bath").time;
  });
  expect(saved).toBe(Date.parse("2026-10-11T13:43:00-07:00"));
  expect(errors).toEqual([]);
});
