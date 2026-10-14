import { goTimeline, goPhotos } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

test("Earlier bath stays connected and exact care dates survive transitions, elapsed time and reload", async ({
  page,
}, info) => {
  await page.clock.setFixedTime(new Date(Date.now() - 120000));
  await join(page, code(info));
  await page.locator('#routine-care [data-care-action="new"]').click();
  await page.locator('[data-care-template="Bath"]').click();
  await page.locator("#care-plan-form .primary").click();
  await page.locator('#log-row [data-act="earlier"]').click();
  await page.locator('[data-early-type="grooming"]').click();
  await page.locator('[data-early-ago="15"]').click();
  await page.locator("[data-early-form]").click();
  await expect(page.locator("#routine-form select")).not.toHaveValue("");
  const time = page.locator('#routine-form [name="time"]');
  const earlier = await time.inputValue();
  await page.getByRole("button", { name: "Pick date", exact: true }).click();
  await expect(time).toHaveValue(earlier);
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  const yesterday = await time.inputValue();
  await page.getByRole("button", { name: "Pick date", exact: true }).click();
  await expect(time).toHaveValue(yesterday);
  await time.fill(earlier);
  await page.getByRole("button", { name: "Pick date", exact: true }).click();
  await expect(time).toHaveValue(earlier);
  await page.locator("#dialog-close").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume bath", exact: true }).click();
  await expect(time).toHaveValue(earlier);
  await page.clock.setFixedTime(new Date(Date.now() - 1000));
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("button", { name: "Pick date", exact: true }).click();
  await page.getByRole("button", { name: "Save bath", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#up-next")).not.toContainText("Bath");
  await page.locator("#undo").click();
  await expect(page.locator("#up-next")).toContainText("Bath");
});

test("care completion settles its reminder, supports yesterday, and Undo restores both", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('#routine-care [data-care-action="new"]').click();
  await page.locator('[data-care-template="Brush"]').click();
  await page
    .locator('#care-plan-form button[type="submit"], #care-plan-form .primary')
    .click();
  await expect(page.locator("#up-next")).toContainText("Brush");
  await page.getByRole("button", { name: "Record brush", exact: true }).click();
  await expect(page.locator("#routine-form select")).not.toHaveValue("");
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await page.getByRole("button", { name: "Save brush", exact: true }).click();
  await expect(
    page.locator(".routine-row", { hasText: "Brush" }),
  ).toContainText("Yesterday");
  await expect(page.locator("#up-next")).not.toContainText("Brush");
  await page.locator("#undo").click();
  await expect(
    page.locator(".routine-row", { hasText: "Brush" }),
  ).toContainText("Not logged yet");
  await expect(page.locator("#up-next")).toContainText("Brush");
  await page.getByRole("button", { name: "Record brush", exact: true }).click();
  await page.getByRole("button", { name: "Save brush", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#up-next")).not.toContainText("Brush");
});

test("entry draft survives dismissal and Earlier keeps the chosen time", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('#log-row [data-act="earlier"]').click();
  await page.locator('[data-early-ago="15"]').click();
  await page.locator("[data-early-form]").click();
  const field = page.locator('#event-form [name="time"]');
  const selected = await field.inputValue();
  expect(Date.now() - Date.parse(selected + "-07:00")).toBeGreaterThan(
    14 * 60000,
  );
  await page
    .locator('#event-form [name="note"]')
    .fill("Keep my unfinished note");
  await page.locator("#dialog-close").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Resume new entry", exact: true })
    .click();
  await expect(page.locator('#event-form [name="note"]')).toHaveValue(
    "Keep my unfinished note",
  );
  await expect(field).toHaveValue(selected);
  await page.locator('#event-form [type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
});

test("photo draft resumes, selected care photo joins Winnie and can be unselected without deleting it", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('#care-actions [data-log="poop"]').click();
  await page.locator("#dialog [data-photo-library]").click();
  await page
    .locator("#library-input")
    .setInputFiles("public/photos/winnie-wall.jpg");
  await expect(page.locator("[data-keep-photo]")).toHaveText("Keep in Winnie");
  await page.locator("[data-keep-photo]").click();
  await expect(page.locator("[data-keep-photo]")).toHaveText("Kept in Winnie");
  await page.locator("#dialog-close").click();
  await goPhotos(page);
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await page.locator('[data-filter="memories"]').click();
  await expect(page.locator("#postcard")).toBeVisible();
  await expect(page.locator("#postcard-photo option")).toHaveCount(1);
  await page.locator("#places-home").click();
  await page.locator("#photo-items .memory-card").click();
  await page.locator("[data-keep-photo]").click();
  await page.locator("#dialog-close").click();
  await expect(page.locator("#photo-count")).toHaveText("0 photos");
  await page.locator('[data-filter="care-photos"]').click();
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await page.locator('[data-filter="moments"]').click();
  await page.locator("#story-add").click();
  await page.locator("[data-album-library]").click();
  await page
    .locator("#library-input")
    .setInputFiles("public/photos/winnie-wall.jpg");
  await expect(page.locator("#photo-draft img")).toHaveCount(1);
  await page
    .locator('#photo-composer [name="note"]')
    .fill("Draft photo caption");
  await page.locator("#dialog-close").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Resume add photos", exact: true })
    .click();
  await expect(page.locator("#photo-draft img")).toHaveCount(1);
  await expect(page.locator('#photo-composer [name="note"]')).toHaveValue(
    "Draft photo caption",
  );
  await page.locator('[data-photo-field="wall"]').fill('2025-12-24T10:30');
  await page.locator('[data-photo-field="timezone"]').selectOption('America/Chicago');
  await page.locator('#photo-composer [type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
});

test("small screens fit and accessible status describes facts", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await join(page, code(info));
  await expect(page.locator("#room-status")).not.toContainText("Awake");
  await expect(page.locator("#sync-chip")).toHaveAccessibleName(/Sync status/);
  const width = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.page).toBeLessThanOrEqual(width.viewport);
  await expect(page.locator("#today-view .room-actions")).toHaveCount(0);
  await page.locator('[data-act="more"]').click();
  await page.getByText("Explore the room", { exact: true }).click();
  await page.getByRole("button", { name: "Pet Winnie", exact: true }).click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await goTimeline(page);
  await expect(page.locator("#story-title")).toBeFocused();
});
