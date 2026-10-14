import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

async function seed(page) {
  await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.25");
    const blob = await (await fetch("/photos/winnie-wall.jpg")).blob();
    for (const [id, day, note] of [
      ["early", "2025-09-05", "Before home"],
      ["home", "2025-10-04", "Our first day"],
      ["home-two", "2025-10-06", "Settling in"],
      ["summer", "2026-07-04", "Summer together"],
    ]) {
      const time = Date.parse(day + "T12:00:00-07:00");
      await sync.enqueue("create", id, {
        type: "moment",
        time,
        timezone: "America/Los_Angeles",
        note,
        retroactive: true,
      });
      await sync.addPhoto(id, blob, {
        capturedAt: time,
        wall: day + "T12:00",
        timezone: "America/Los_Angeles",
        origin: "manual",
      });
    }
  });
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
}
async function memories(page) {
  await page.locator("#story-tab").click();
  await page.locator('[data-filter="memories"]').click();
  await page.locator('#life-yearbook-tool > summary').click();
}

test("chapter covers and separate recollections survive reload and export in a portable album", async ({
  page,
  context,
}, info) => {
  const shared = code(info),
    errors = await join(page, shared);
  await seed(page);
  await memories(page);
  await expect(page.locator("#album-title")).toHaveText("His first year");
  await expect(page.locator(".album-chapter h3")).toHaveText("2 months old");
  await page.locator("[data-album-cover]").click();
  await page
    .getByRole("button", { name: "Choose photo from 2025-10-04", exact: true })
    .click();
  await expect(page.locator(".album-caption")).toHaveText("Our first day");
  await page.locator(".album-actions [data-recollect]").click();
  await page
    .locator("#recollection-form textarea")
    .fill("He fell asleep in my arms. <script>no</script>");
  await page
    .getByRole("button", { name: "Save recollection", exact: true })
    .click();
  await expect(page.locator(".album-chapter")).toContainText(
    "Brandon remembers",
  );
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  const kim = await context
      .browser()
      .newContext({
        baseURL: info.project.use.baseURL,
        viewport: { width: 390, height: 844 },
      }),
    other = await kim.newPage();
  await join(other, shared, "kim");
  await memories(other);
  await other.locator(".album-actions [data-recollect]").click();
  await other.locator("#recollection-form textarea").fill("Those tiny paws!");
  await other
    .getByRole("button", { name: "Save recollection", exact: true })
    .click();
  await expect(other.locator("#dialog")).not.toBeVisible();
  await expect(other.locator(".album-chapter")).toContainText("Those tiny paws!");
  await expect(other.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await memories(page);
  await expect(page.locator(".album-caption")).toHaveText("Our first day");
  await expect(page.locator(".album-chapter .remembered-words")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.locator("[data-album-save]").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("winnie-year-1.html");
  const fs = await import("node:fs/promises"),
    html = await fs.readFile(await file.path(), "utf8");
  expect(html.startsWith("<!doctype html>")).toBe(true);
  const offline = await context.browser().newContext({ offline: true });
  const album = await offline.newPage();
  await album.setContent(html);
  await expect(album.locator("h1")).toHaveText("Winnie's first year");
  await expect(album.locator("img")).toHaveCount(3);
  await expect
    .poll(() =>
      album
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await offline.close();
  expect(html).toContain("Those tiny paws!");
  expect(html).toContain("&lt;script&gt;no&lt;/script&gt;");
  expect(html).toContain("data:image/jpeg;base64,");
  expect(html).toContain("Print or save as PDF");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  await kim.close();
});

test("photo picker reaches the full library with a bounded grid and date search", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await seed(page);
  await page.evaluate(async () => {
    const { pickMemoryPhoto } = await import("/app/photo-picker.js?v=4.25");
    const { selectedPhotos } = await import("/lifetime.js?v=4.25");
    const { facts } = await import("/app/services.js?v=4.25");
    const source = selectedPhotos(facts())[0];
    const photos = Array.from({ length: 5000 }, (_, i) => ({
      ...source,
      day: i === 4999 ? "2025-10-04" : "2026-07-04",
      photo: { ...source.photo, id: source.photo.id },
      event: {
        ...source.event,
        note: i === 4999 ? "The homecoming photo" : "",
      },
    }));
    pickMemoryPhoto({
      photos,
      onChoose: (p) => {
        document.querySelector("#memory-picker-count").textContent =
          p.event.note;
      },
    });
  });
  await expect(page.locator("#memory-picker-count")).toHaveText("5,000 photos");
  await expect(page.locator("#memory-picker-grid button")).toHaveCount(24);
  await page.locator("#memory-picker-search").fill("homecoming");
  await expect(page.locator("#memory-picker-grid button")).toHaveCount(1);
  await page.locator("#memory-picker-grid button").click();
  await expect(page.locator("#memory-picker-count")).toHaveText(
    "The homecoming photo",
  );
  expect(errors).toEqual([]);
});
