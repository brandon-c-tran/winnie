import { goTimeline, goPhotos } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

test("one reaction picker belongs to its sheet; Escape and replacement menus recover", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator('#care-actions [data-log="pee"]').click();
  const row = page.locator("#timeline .feed-entry").first();
  await row.locator("[data-reaction-picker]").click();
  await expect(page.locator(".reaction-picker")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".reaction-picker")).toHaveCount(0);
  await row.locator(".entry").click();
  await page.locator("#dialog [data-reaction-picker]").click();
  await expect(page.locator(".reaction-picker")).toHaveCount(1);
  await expect(page.locator("#dialog .reaction-picker")).toBeVisible();
  await expect(row.locator("[data-reaction-picker]")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.screenshot({ path: info.outputPath("reaction-in-sheet.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).toHaveAttribute("open", "");
  await page.locator("#dialog [data-reaction-picker]").click();
  await page
    .getByRole("button", { name: "React with Love", exact: true })
    .click();
  await expect(page.locator("#dialog .reaction-total")).toContainText("1");
  await page.locator("#dialog [data-reaction-picker]").click();
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  await expect(page.locator(".reaction-picker")).toHaveCount(0);
  await expect(page.locator("#event-form")).toBeVisible();
  expect(errors).toEqual([]);
});

test("History and Gallery keep independent filters and actual photos", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  // Isolated fixture through the actual offline queue and photo upload pipeline.
  await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.24");
    const image = new Image();
    image.src = "/photos/winnie-smile.png";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 320;
    canvas.getContext("2d").drawImage(image, 0, 0, 320, 320);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg"),
    );
    for (const type of ["moment", "poop", "meal"]) {
      const id = crypto.randomUUID();
      await sync.enqueue("create", id, {
        type,
        time: Date.now() - 60000,
        note: `Photo ${type}`,
      });
      await sync.addPhoto(id, blob);
    }
  });
  await goTimeline(page);
  await page.locator("#story-search").fill("Photo poop");
  await expect(page.locator("#story-count")).toHaveText("1 entry");
  await goPhotos(page);
  await expect(page.locator('#photo-collection')).toHaveValue('moments');
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await expect(page.locator("#photo-items .memory-card img")).toHaveAttribute(
    "src",
    /blob:|\.netlify/,
  );
  await page.screenshot({
    path: info.outputPath("gallery.png"),
    fullPage: true,
  });
  await page.locator('#photo-collection').selectOption('care-photos');
  await expect(page.locator("#photo-count")).toHaveText("2 photos");
  await page.locator("#photo-search").fill("Photo meal");
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await goTimeline(page);
  await expect(page.locator("#story-search")).toHaveValue("Photo poop");
  await expect(page.locator("#story-count")).toHaveText("1 entry");
  await page.locator("#history-clear").click();
  await page.screenshot({
    path: info.outputPath("history.png"),
    fullPage: true,
  });
  await goPhotos(page);
  await expect(page.locator("#photo-search")).toHaveValue("Photo meal");
  expect(errors).toEqual([]);
});

test("Places opens destinations and their source logs without losing the list", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.24");
    for (const [lat, lng] of [
      [37.7749, -122.4194],
      [37.8044, -122.2712],
      [34.0522, -118.2437],
    ]) {
      await sync.enqueue("create", crypto.randomUUID(), {
        type: "pee",
        time: Date.now() - 60000,
        placePin: { lat, lng, accuracy: 10, capturedAt: Date.now() - 60000 },
      });
    }
  });
  await goPhotos(page);
  await page.locator('[data-filter="places"]').click();
  await expect(page.locator(".place-city")).toHaveCount(3);
  await page.screenshot({
    path: info.outputPath("places.png"),
    fullPage: true,
  });
  await page.locator(".place-city", { hasText: "San Francisco" }).click();
  await expect(page.locator(".place-history")).toContainText("San Francisco");
  await page.locator(".place-day summary").click();
  await expect(page.locator(".place-history .entry")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "City map" })).toHaveAttribute(
    "href",
    /google.com\/maps/,
  );
  await page
    .getByRole("button", { name: "Back to places", exact: true })
    .click();
  await expect(page.locator(".place-city")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("new room poses render, settle after interruption and respect reduced motion", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  const result = await page.evaluate(async () => {
    const { room } = await import("/app/services.js?v=4.24");
    for (const pose of [
      "belly",
      "roll",
      "bow",
      "scratch",
      "tilt",
      "jump",
      "shake",
      "greet",
      "carry",
      "sleepToy",
      "eat",
    ])
      room.place(54, pose);
    room.react("toy");
    room.set({ sleep: "nap" }, { instant: true });
    const sleep = { pose: room.dog.pose, toy: room.dog.toy, bob: room.dog.bob };
    room.set({ sleep: null }, { instant: true });
    return sleep;
  });
  expect(result).toEqual({ pose: "sleep", toy: false, bob: 0 });
  await page.locator('#care-actions [data-log="pee"]').click();
  await page.screenshot({ path: info.outputPath("today.png"), fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // WebKit dispatches the media-query change on a later rendering turn.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { room } = await import("/app/services.js?v=4.24");
        room.react("toy");
        return { pose: room.dog.pose, toy: room.dog.toy };
      }),
    )
    .toEqual({ pose: "sit", toy: false });
  expect(errors).toEqual([]);
});
