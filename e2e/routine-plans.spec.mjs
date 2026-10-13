import { test, expect } from "@playwright/test";
import { code, join, toast } from "./helpers.mjs";

test("training imports remain planned until a past visit is confirmed", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  const now = Date.now(),
    schedule = {
      checkedAt: new Date(now).toISOString(),
      through: "2027-01-01",
      visits: [
        {
          id: "past-visit",
          title: "Training fixture",
          start: now - 7200000,
          end: now - 3600000,
        },
        {
          id: "next-visit",
          title: "Next training fixture",
          start: now + 86400000,
          end: now + 90000000,
        },
      ],
    };
  await page.locator("#plans-tab").click();
  await page.locator('#training-visits [data-act="trainer-schedule"]').click();
  await page
    .locator("#trainer-import")
    .setInputFiles({
      name: "training.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(schedule)),
    });
  await page.locator("#save-trainer-import").click();
  await expect(page.locator("#dialog")).toContainText("Next training fixture");
  await page.locator('[data-visit="past-visit"]').click();
  await expect(
    page
      .locator("#dialog .scheduled-visit", { hasText: "Training fixture" })
      .first(),
  ).toContainText("Logged");
  await page.locator("#dialog-close").click();
  await expect(page.locator("#training-visits")).toContainText(
    "Next training fixture",
  );
  await page.locator("#today-tab").click();
  await expect(page.locator("#timeline")).not.toContainText(
    "Next training fixture",
  );
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await page.locator("#plans-tab").click();
  await expect(page.locator("#training-visits")).toContainText(
    "Next training fixture",
  );
  expect(errors).toEqual([]);
});

test("care stays visible, records last done, survives reload and Undo", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await expect(page.locator(".routine-row")).toHaveCount(6);
  const brush = page.locator(".routine-row", { hasText: "Brush" });
  await expect(brush).toContainText("Not logged yet");
  await brush.getByRole("button", { name: "Log brush now" }).click();
  await expect(brush).toContainText("Today");
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await expect(brush).toContainText("Today");
  await brush.locator(".routine-last").click();
  await expect(page.locator("#dialog-title")).toContainText("Brush");
  await page.locator("#dialog-close").click();
  const ears = page.locator(".routine-row", { hasText: "Ears" });
  await ears.getByRole("button", { name: "Log ears now" }).click();
  await expect(ears).toContainText("Today");
  await page.locator("#undo").click();
  await expect(ears).toContainText("Not logged yet");
  expect(errors).toEqual([]);
});

test("supplies share state and monthly dose stays separate from refill", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await page.locator("#plans-tab").click();
  await page.getByRole("button", { name: "Update wipes" }).click();
  await page.locator('#supply-form [value="low"]').check();
  await page
    .locator('#supply-form [name="link"]')
    .fill("https://example.com/wipes");
  await page.locator("#supply-form .primary").click();
  await expect(page.locator(".supply-row", { hasText: "Wipes" })).toContainText(
    "Running low",
  );
  await page.getByRole("button", { name: "Set monthly dose reminder" }).click();
  await expect(page.locator('#care-plan-form [name="unit"]')).toHaveValue(
    "month",
  );
  await expect(page.locator('#care-plan-form [name="type"]')).toHaveValue(
    "medication",
  );
  for (const width of [320, 390, 560]) {
    await page.setViewportSize({ width, height: 844 });
    const contained = await page.locator("#care-plan-form").evaluate((form) => {
      const box = form.getBoundingClientRect();
      return [
        ...form.querySelectorAll("input:not([type=hidden]),select,textarea"),
      ]
        .filter((e) => e.getClientRects().length)
        .every((e) => {
          const r = e.getBoundingClientRect();
          return r.left >= box.left - 1 && r.right <= box.right + 1;
        });
    });
    expect(contained).toBe(true);
  }
  await page.locator("#care-plan-form .primary").click();
  await expect(toast(page)).toContainText("Reminder saved");
  await page.getByRole("button", { name: "Update heartgard" }).click();
  await page.locator('#supply-form [value="ordered"]').check();
  await page.locator("#supply-form .primary").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(
    page.locator(".supply-row", { hasText: "Heartgard" }),
  ).toContainText("Ordered");
  await expect(page.locator("#sync-status")).toHaveText("Up to date");
  await page.reload();
  await page.locator("#plans-tab").click();
  await expect(page.locator(".supply-row", { hasText: "Wipes" })).toContainText(
    "Running low",
  );
  await expect(
    page.locator(".supply-row", { hasText: "Heartgard" }),
  ).toContainText("Ordered");
  await expect(page.locator("#care-upcoming")).toContainText("Heartgard");
  await page.locator("#today-tab").click();
  await expect(page.locator("#timeline")).not.toContainText("Heartgard");
  expect(errors).toEqual([]);
});
