import { goTimeline } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

for (const person of ["brandon", "kim"])
  test(`${person}: whole portraits, automatic poop photo prompt and Today preview`, async ({
    page,
  }, info) => {
    const errors = await join(page, code(info, person), person);
    const before = await page.locator("#timeline .feed-entry").count();
    for (const width of [320, 390, 560]) {
      await page.setViewportSize({ width, height: 844 });
      const placement = await page.locator("#settings").evaluate((button) => {
        const photo = button.querySelector("img"),
          p = photo.getBoundingClientRect(),
          b = button.getBoundingClientRect();
        return {
          inside:
            p.left >= b.left &&
            p.right <= b.right &&
            p.top >= b.top &&
            p.bottom <= b.bottom,
          style: getComputedStyle(photo).objectFit,
          src: photo.getAttribute("src"),
        };
      });
      expect(placement.inside).toBe(true);
      expect(placement.style).toBe("contain");
      expect(placement.src).toBe(`/photos/${person}-pixel.png`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#care-actions [data-log="poop"]').click();
    await expect(page.locator("#dialog-title")).toHaveText("Poop photo");
    await expect(
      page.getByRole("button", { name: "Take photo", exact: true }),
    ).toBeVisible();
    await page.locator('#dialog [data-quality="firm"]').click();
    await expect(page.locator("#dialog-title")).toHaveText("Poop photo");
    await expect(page.locator('#dialog [data-quality="firm"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Take photo", exact: true }).click(),
    ]);
    await expect(page.locator("#camera-input")).toHaveAttribute(
      "capture",
      "environment",
    );
    await chooser.setFiles("public/photos/winnie-smile.png");
    await expect(page.locator("#dialog-title")).toHaveText("Photo saved");
    await expect(page.locator("[data-keep-photo]")).toBeVisible();
    await page.getByRole("button", {name:"Done", exact:true}).click();
    await expect(page.locator("#dialog")).not.toBeVisible();
    const row = page.locator("#timeline .feed-entry").first();
    await expect(row.locator(".record-author img")).toHaveAttribute(
      "src",
      `/photos/${person}-pixel.png`,
    );
    await expect(row.locator(".record-photo img")).toHaveAttribute(
      "src",
      /blob:/,
    );
    await expect(row).toContainText("Firm stool");
    await expect(page.locator("#timeline .feed-entry")).toHaveCount(before + 1);
    await expect(page.locator("#sync-status")).toHaveText("Up to date");
    await page.reload();
    await expect(page.locator("#timeline .record-photo img")).toHaveAttribute(
      "src",
      /blob:/,
    );
    await expect(page.locator("#dialog")).not.toBeVisible();
    await page.locator('#care-actions [data-log="poop"]').click();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(page.locator("#timeline .feed-entry")).toHaveCount(before + 2);
    await expect(page.locator("#timeline .record-photo")).toHaveCount(1);
    await goTimeline(page);
    await expect(page.locator("#story-items .record-photo")).toHaveCount(0);
    await expect(page.locator("#story-items .entry-photo-link")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
