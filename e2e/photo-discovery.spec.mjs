import { test, expect } from "@playwright/test";
import { join, code, goPhotos } from "./helpers.mjs";
test.use({ serviceWorkers: "block" });

async function addFixtures(page) {
  await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.28");
    for (let i = 0; i < 7; i++) {
      const day = `2026-0${i + 1}-10`,
        time = Date.parse(day + "T12:00:00-08:00");
      const blob = await (await fetch("/photos/winnie-wall.jpg")).blob();
      await sync.enqueue("create", "discovery-" + i, {
        type: "moment",
        time,
        note: "Saved family caption " + i,
        timezone: "America/Los_Angeles",
        retroactive: true,
      });
      await sync.addPhoto(
        "discovery-" + i,
        blob,
        {
          capturedAt: time,
          wall: day + "T12:00",
          timezone: "America/Los_Angeles",
          origin: "manual",
        },
        "discovery-photo-" + i,
      );
    }
    await sync.flush();
  });
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
}

test("photo discovery scans opt-in samples, corrects labels, keeps pairs and shares editable collections", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await addFixtures(page);
  await goPhotos(page);
  await page.locator("[data-discovery-settings]").first().click();
  await expect(
    page.locator("#scan-controls [type=checkbox]").first(),
  ).not.toBeChecked();
  await page.locator("[name=consent]").check();
  await page.getByRole("button", { name: "Try five photos" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { sync } = await import("/app/services.js?v=4.28");
        return Object.keys((await sync.request("photo-ai")).results).length;
      }),
    )
    .toBe(5);
  await page.getByRole("button", { name: "Refresh scan results" }).click();
  await expect(page.locator(".scan-result")).toHaveCount(5);
  await page.locator("[data-correct-photo]").first().click();
  await page.locator("textarea[name=description]").fill("A dog on the couch.");
  await page.locator('[name=concept][value="pink bed"]').uncheck();
  await page.locator('[name=concept][value="couch"]').check();
  await page
    .getByRole("button", { name: "Save description", exact: true })
    .click();
  await expect(page.locator(".scan-result").first()).toContainText(
    "Edited by you",
  );
  await page.locator("#dialog-close").click();
  await expect(
    page.locator(".discovery-spread").first().locator("img"),
  ).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".discovery-photo img")
        .first()
        .evaluate((i) => i.complete && i.naturalWidth > 0),
    )
    .toBe(true);
  await page.locator("[data-keep-pair]").click();
  await expect(page.locator(".discovery-saved summary")).toHaveText(
    "Saved comparisons (1)",
  );
  await page.locator("[data-new-collection]").click();
  await page
    .locator("#collection-editor [name=name]")
    .fill("Our little couch potato");
  await page.locator(".collection-choice input").nth(0).check();
  await page.locator(".collection-choice input").nth(1).check();
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await expect(page.locator("#photo-count")).toHaveText("2 photos");
  await page.locator("[data-edit-collection]").click();
  await page.locator("#collection-editor [name=name]").fill("Home memories");
  await page.locator(".collection-choice input").nth(1).uncheck();
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await goPhotos(page);
  await page
    .getByRole("button", { name: "All Winnie photos", exact: true })
    .click();
  await page.locator("#photo-search").fill("couch");
  await expect(page.locator("#photo-count")).toHaveText("1 photo");
  await expect(page.locator("#photo-items")).toContainText(
    "Saved family caption",
  );
  await page.setViewportSize({ width: 320, height: 740 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test("disconnected scan setup is explicit and collections still work", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await goPhotos(page);
  await page.route("**/api?action=photo-ai", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({
      response: res,
      json: { ...json, configured: false },
    });
  });
  await page.locator("[data-discovery-settings]").first().click();
  await expect(
    page.getByRole("button", { name: "Try five photos" }),
  ).toBeDisabled();
  await expect(page.locator("#dialog")).toContainText(
    "Scanning is not connected yet",
  );
  await page.locator("#dialog-close").click();
  await page.locator("[data-new-collection]").click();
  await page
    .locator("#collection-editor [name=name]")
    .fill("Adventures to come");
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await expect(page.locator("[data-filter-collection]").last()).toContainText(
    "Adventures to come",
  );
  expect(errors).toEqual([]);
});
