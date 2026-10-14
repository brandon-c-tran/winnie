import { goTimeline } from './helpers.mjs';
import { test, expect } from "@playwright/test";
import { code, join, toast } from "./helpers.mjs";

async function addFood(page, name, perBag, onHand) {
  await page.locator('[data-pantry="new"]').first().click();
  await page.locator('#food-form [name="name"]').fill(name);
  await page.locator('#food-form [name="perPackage"]').fill(String(perBag));
  await page.locator('#food-form [name="servings"]').fill(String(onHand));
  await page.locator('#food-form [name="link"]').fill("https://www.amazon.com/dp/B000TEST");
  await page.locator("#food-form .primary").click();
  await expect(toast(page)).toContainText(`${name} saved`);
}

test("food on hand: add, restock, and the order reminder in Up next", async ({ page }, info) => {
  const errors = await join(page, code(info));
  await page.locator("#plans-tab").click();
  await addFood(page, "Beef", 14, 3);
  const row = page.locator(".pantry .food-row", { hasText: "Beef" });
  await expect(row).toContainText("3 meals");
  await expect(row.locator("a", { hasText: "Reorder" })).toHaveAttribute("href", /amazon\.com/);

  // 3 meals at 2 a day is inside 3 days of delivery plus slack
  await page.locator("#today-tab").click();
  await expect(page.locator("#up-next")).toContainText("Order food");
  await page.locator('[data-pantry="ordered"]').click();
  await expect(page.locator("#up-next")).toContainText("Food ordered");
  await page.locator('[data-pantry="arrived"]').click();
  await page.locator('#dialog [data-pantry="restock"]').click();
  await expect(page.locator("#dialog")).toContainText("17 meals");
  await page.locator('[data-pantry="done-arrived"]').click();
  await expect(page.locator("#up-next")).not.toContainText("Order food");
  await expect(page.locator("#up-next")).not.toContainText("Food ordered");

  // a Beef meal takes one off and shows up in the meal sheet
  await page.locator('#log-row [data-log="meal"]').click();
  await expect(page.locator('[data-food="Beef"]')).toContainText("17 left");
  await page.locator('[data-food="Beef"]').click();
  await page.locator("#plans-tab").click();
  await expect(row).toContainText("16 meals");
  expect(errors).toEqual([]);
});

test("poop quality: tag right after a poop, then it shows by food in Trends", async ({ page }, info) => {
  const errors = await join(page, code(info));
  // each poop pairs with the meal before it
  for (const q of ["Firm", "Soft", "Firm"]) {
    await page.locator('#log-row [data-log="meal"]').click();
    await page.locator('#custom-food input').fill("Chicken");
    await page.locator('#custom-food button[type="submit"]').click();
    await expect(toast(page)).toContainText("Meal logged");
    await page.locator('#care-actions [data-log="poop"]').click();
    await expect(page.locator("#poop-quality")).toBeVisible();
    await page.locator("#dialog [data-quality]", { hasText: q }).click();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(page.locator("#poop-quality")).toBeHidden();
    await page.waitForTimeout(650); // past the double-tap guard on log buttons
  }
  // the detail sheet shows the tag and can change it
  await page.locator("#timeline .entry", { hasText: "Poop" }).first().click();
  await expect(page.locator('#dialog [data-quality="firm"]')).toHaveClass(/selected/);
  await page.keyboard.press("Escape");

  await goTimeline(page);
  await page.locator('#insights-tab').click();
  await page.locator('.recent-insights > summary').click();await page.locator('[data-rhythm="poop"]').click();
  await expect(page.locator(".by-food")).toContainText("Chicken");
  await expect(page.locator(".by-food")).toContainText("1 of 3 soft or loose");
  expect(errors).toEqual([]);
});

test("food options can be removed, synced and restored without changing past meals", async ({ page, browser }, info) => {
  const shared = code(info), errors = await join(page, shared);
  await page.locator('#log-row [data-log="meal"]').click();
  await expect(page.locator('[data-food]')).toHaveCount(0);
  await page.locator('#custom-food input').fill("Turkey");
  await page.locator('#custom-food button[type="submit"]').click();
  await expect(toast(page)).toContainText("Meal logged");
  await page.locator('#log-row [data-log="meal"]').click();
  await expect(page.locator('[data-food="Turkey"]')).toBeVisible();
  await page.getByRole('button', { name: 'Manage foods', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Turkey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore Turkey', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to meal', exact: true }).click();
  await expect(page.locator('[data-food="Turkey"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#timeline')).toContainText('Turkey');
  await expect(page.locator('#sync-status')).toHaveText('Up to date');
  await page.reload();
  await page.locator('#log-row [data-log="meal"]').click();
  await expect(page.locator('[data-food="Turkey"]')).toHaveCount(0);

  const other = await browser.newContext({ baseURL: info.project.use.baseURL });
  try {
    const kim = await other.newPage();
    await join(kim, shared, 'kim');
    await kim.locator('#log-row [data-log="meal"]').click();
    await expect(kim.locator('[data-food="Turkey"]')).toHaveCount(0);
    await kim.getByRole('button', { name: 'Manage foods', exact: true }).click();
    await kim.getByRole('button', { name: 'Restore Turkey', exact: true }).click();
    await kim.getByRole('button', { name: 'Back to meal', exact: true }).click();
    await expect(kim.locator('[data-food="Turkey"]')).toBeVisible();
  } finally { await other.close(); }
  expect(errors).toEqual([]);
});

test("removing pantry stock also removes its historical meal option", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator('#plans-tab').click();
  await addFood(page, 'Beef', 14, 14);
  await page.locator('#today-tab').click();
  await page.locator('#log-row [data-log="meal"]').click();
  await page.locator('[data-food="Beef"]').click();
  await expect(toast(page)).toContainText('Meal logged');
  await page.locator('#plans-tab').click();
  await page.locator('.pantry [data-pantry="edit"]').click();
  await page.locator('[data-pantry="remove"]').click();
  await page.locator('#today-tab').click();
  await expect(page.locator('#timeline')).toContainText('Beef');
  await page.locator('#log-row [data-log="meal"]').click();
  await expect(page.locator('[data-food="Beef"]')).toHaveCount(0);
});
