import { expect } from "@playwright/test";

const run = Date.now().toString(36);

// Each test gets its own isolated shared log on the dev server.
export function code(testInfo, suffix = "") {
  return `winnie-e2e-${run}-${testInfo.project.name}-${testInfo.testId}${suffix}`;
}

export async function join(page, shared, who = "brandon") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#shared-code").fill(shared);
  await page.locator(`.radio-person:has(input[value="${who}"])`).click();
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.locator("#today-view")).toBeVisible();
  await expect(page.locator("#sync-status")).toHaveText(
    /Up to date|not sent|Sending/,
  );
  return errors;
}

export const toast = (page) => page.locator("#toast-text");
