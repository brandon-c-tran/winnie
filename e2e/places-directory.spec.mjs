import { goPhotos } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

test("Places groups care evidence by destination, spot and recorded day", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.evaluate(async () => {
    const { sync } = await import("/app/services.js?v=4.22");
    for (const row of [
      {
        type: "pee",
        location: "Fort Funston",
        time: Date.parse("2026-01-02T07:00:00Z"),
        placePin: {
          lat: 37.7749,
          lng: -122.4194,
          accuracy: 10,
          capturedAt: Date.now(),
        },
      },
      {
        type: "poop",
        location: "Fort Funston",
        time: Date.parse("2026-01-02T07:05:00Z"),
        placePin: {
          lat: 37.7749,
          lng: -122.4194,
          accuracy: 10,
          capturedAt: Date.now(),
        },
      },
      {
        type: "pee",
        location: "The park",
        time: Date.parse("2026-01-03T07:00:00Z"),
        placePin: {
          lat: 37.7749,
          lng: -122.4194,
          accuracy: 10,
          capturedAt: Date.now(),
        },
      },
      {
        type: "pee",
        location: "Grandma's",
        time: Date.parse("2026-01-03T07:00:00Z"),
      },
    ])
      await sync.enqueue("create", crypto.randomUUID(), row);
  });
  await goPhotos(page);
  await page.locator('[data-filter="places"]').click();
  await expect(page.locator("#story-title")).toHaveText("Story");
  await expect(page.locator('[data-filter="places"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator("#travel-map")).toBeVisible();
  await expect(
    page.locator(".place-city", { hasText: "San Francisco" }),
  ).toContainText("2");
  await page.getByRole("searchbox", { name: "Find a place" }).fill("Fort");
  await expect(page.locator(".place-city")).toHaveCount(1);
  await page.locator(".place-city").click();
  await expect(page.locator(".place-day")).toHaveCount(2);
  await expect(page.locator(".place-day[open]")).toHaveCount(0);
  await page.locator("[data-place-spot]").selectOption("fort funston");
  await expect(page.locator(".place-day")).toHaveCount(1);
  await expect(page.locator(".place-day summary")).toContainText("Jan 1, 2026");
  await expect(page.locator(".place-day summary")).toContainText("2 logs");
  await page.locator(".place-day summary").click();
  await page.locator(".place-day .entry").first().click();
  await expect(page.locator(".detail-place")).toContainText("Fort Funston");
  await page.locator("#dialog-close").click();
  await expect(page.locator(".place-day")).toHaveAttribute("open", "");
  await page
    .getByRole("button", { name: "Back to places", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Find a place" }),
  ).toHaveValue("Fort");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.locator(".place-city", { hasText: "Grandma's" }).click();
  await expect(page.locator(".place-heading")).toContainText("Saved by name");
  await expect(page.getByRole("link", { name: "City map" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to places", exact: true }).click();
  await page.locator("#places-home").click();
  await expect(page.locator("#places-home")).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator("#story-add")).toBeVisible();
  expect(errors).toEqual([]);
});
