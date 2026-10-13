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
    const { sync } = await import("/app/services.js?v=4.7");
    await sync.enqueue("create", crypto.randomUUID(), {
      type: "poop",
      time: Date.now() - 60000,
      tags: ["firm", "outdoors"],
      location: "San Carlos",
      who: "trainer",
      note,
    });
  }, note);
  await page.locator("#history-tab").click();
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
