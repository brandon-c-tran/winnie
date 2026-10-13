import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

test("photo-first composer saves previews to Winnie and survives reload", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator("#photos-tab").click();
  await page.locator("#story-add").click();
  await expect(page.locator("#photo-composer [type=submit]")).toBeDisabled();
  await page.locator("[data-album-library]").click();
  await page
    .locator("#library-input")
    .setInputFiles([
      "public/photos/winnie-smile.png",
      "public/photos/winnie-story.png",
    ]);
  await expect(page.locator("#photo-draft img")).toHaveCount(2);
  await page.locator('[data-remove-draft="1"]').click();
  await expect(page.locator("#photo-draft img")).toHaveCount(1);
  await page
    .locator('#photo-composer [name="note"]')
    .fill("Afternoon in the garden");
  await page.locator("#photo-composer [type=submit]").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await expect(page.locator(".photo-caption")).toContainText(
    "Afternoon in the garden",
  );
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await page.locator("#photos-tab").click();
  await expect(page.locator("#photo-items .memory-card img")).toHaveAttribute(
    "src",
    /blob:/,
  );
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await page.locator('[data-filter="care-photos"]').click();
  await expect(page.locator("#photo-count")).toHaveText("0 photos");
  expect(errors).toEqual([]);
});

test("attach care photos to the existing entry without creating a duplicate", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator('#care-actions [data-log="poop"]').click();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.locator("#photos-tab").click();
  await page.locator('[data-filter="care-photos"]').click();
  await page.locator("#story-add").click();
  await page.locator("#attach-search").fill("poop");
  await page.locator("[data-attach-entry]").first().click();
  await page
    .locator("#library-input")
    .setInputFiles("public/photos/winnie-smile.png");
  await expect(page.locator("#dialog .detail-photo")).toHaveAttribute(
    "src",
    /blob:/,
  );
  await page.locator("#dialog-close").click();
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await expect(page.locator(".care-photo-record")).toHaveCount(1);
  await page.locator("#history-tab").click();
  await page.locator("#history-type").selectOption("poop");
  await expect(page.locator("#story-count")).toHaveText("1 entry");
  await expect(page.locator("#story-items .entry-photo-link")).toHaveText(
    "1 photo",
  );
  await page.locator("#photos-tab").click();
  await page.locator('[data-filter="moments"]').click();
  await expect(page.locator("#photo-count")).toHaveText("0 photos");
  expect(errors).toEqual([]);
});

test("discarded selection and invalid file leave no new entries", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator("#history-tab").click();
  const originalCount = await page.locator("#story-count").textContent();
  await page.locator("#photos-tab").click();
  await page.locator("#story-add").click();
  await page.locator("[data-album-library]").click();
  await page
    .locator("#library-input")
    .setInputFiles({
      name: "bad.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not an image"),
    });
  await expect(page.locator("#form-error")).toContainText(
    "could not be opened",
  );
  await page.locator("[data-album-library]").click();
  await page
    .locator("#library-input")
    .setInputFiles("public/photos/winnie-smile.png");
  await expect(page.locator("#photo-draft img")).toHaveCount(1);
  await page.locator("#dialog-close").click();
  await page.locator("#history-tab").click();
  await expect(page.locator("#story-count")).toHaveText(originalCount);
  expect(errors).toEqual([]);
});
