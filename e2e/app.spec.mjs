import { test, expect } from "@playwright/test";
import { code, join, toast } from "./helpers.mjs";

test("Today opens on the room with the log buttons and tabs", async ({
  page,
}, info) => {
  const errors = await join(page, code(info));
  await expect(page.locator("#room")).toBeVisible();
  await expect(page.locator('#care-actions [data-log="pee"]')).toContainText(
    "Pee",
  );
  await expect(page.locator('#care-actions [data-log="poop"]')).toContainText(
    "Poop",
  );
  for (const tab of ["Today", "Plans", "History", "Photos"])
    await expect(page.locator("#tabbar")).toContainText(tab);
  await expect(page.locator("#room-status")).toContainText("Awake");
  expect(errors).toEqual([]);
});

test("logging pee shows Undo, and Undo removes it", async ({ page }, info) => {
  await join(page, code(info));
  const before = await page.locator("#timeline .feed-entry").count();
  await page.locator('#care-actions [data-log="pee"]').click();
  await expect(toast(page)).toContainText("Pee logged");
  await expect(
    page.locator('#care-actions [data-log="pee"] .meta'),
  ).toContainText("Just now");
  await expect(page.locator("#timeline .feed-entry")).toHaveCount(before + 1);
  await page.locator("#undo").click();
  await expect(page.locator("#timeline .feed-entry")).toHaveCount(before);
});

test("a meal is logged from the food sheet", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator('#log-row [data-log="meal"]').click();
  await page.locator('[data-food="Chicken"]').click();
  await expect(toast(page)).toContainText("Meal logged");
  await expect(page.locator("#timeline")).toContainText("Chicken");
});

test("a bath from More shows up in History's last-time counters", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('[data-act="more"]').click();
  await page.locator('#dialog [data-groom="Bath"]').click();
  await expect(toast(page)).toContainText("Bath logged");
  await page.locator("#history-tab").click();
  await expect(page.locator("#last-times")).toContainText("Bath");
});

test("Earlier logs poop 30 minutes ago", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator('#log-row [data-act="earlier"]').click();
  await page.locator('[data-early-type="poop"]').click();
  await page.locator('[data-early-ago="30"]').click();
  await page.locator("[data-early-save]").click();
  await expect(toast(page)).toContainText("Poop logged for");
  // Check History, not today's list: 30 minutes ago can be yesterday just after midnight.
  await page.locator("#history-tab").click();
  await expect(page.locator("#story-items")).toContainText("Poop");
});

test("press and hold a log button opens Log earlier", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('#care-actions [data-log="pee"]').click({ delay: 700 });
  await expect(page.locator("#dialog-title")).toHaveText("Log earlier");
  await expect(page.locator('[data-early-type="pee"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a walk empties the room and finishes with one tap", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('[data-act="more"]').click();
  await page.locator('[data-act="start-walk"]').click();
  await expect(page.locator("#room-status")).toContainText("Out on a walk");
  await page.locator('#room-status [data-act="finish-walk"]').click();
  await expect(toast(page)).toContainText("Walk finished");
  await expect(page.locator("#room-status")).toContainText("Awake");
});

test("a recurring bath plan shows in Up next and Done logs it", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator("#plans-tab").click();
  await page.locator('#plans-view .view-head [data-care-action="new"]').click();
  await page.locator('[data-care-template="Bath"]').click();
  const form = page.locator("#care-plan-form");
  await form.locator('[name="unit"]').selectOption("week");
  await form.locator('[name="every"]').fill("3");
  await form.locator(".primary").click();
  await expect(toast(page)).toContainText("Reminder saved");
  await page.locator("#today-tab").click();
  await expect(page.locator("#up-next")).toContainText("Bath");
  await page.locator('#up-next [data-care-action="complete"]').click();
  await page.locator("#care-complete-form .primary").click();
  await expect(toast(page)).toContainText("Bath done");
});

test("a note goes on the fridge", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator('#fridge-board [data-fridge="new"]').first().click();
  await page
    .locator('#fridge-note-form [name="text"]')
    .fill("Out of chicken. Duck until Saturday.");
  await page
    .locator("#fridge-note-form [type=submit], #fridge-note-form .primary")
    .first()
    .click();
  await expect(page.locator("#fridge-board .sticky")).toContainText(
    "Out of chicken",
  );
});

test("History searches and Trends draws the 14-day chart", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('#care-actions [data-log="poop"]').click();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.locator("#history-tab").click();
  await page.locator("#story-search").fill("poop");
  await expect(page.locator("#story-items")).toContainText("Poop");
  await page.locator('[data-history="patterns"]').click();
  await expect(page.locator("#story-items")).toContainText(
    "Pee and poop, last 14 days",
  );
});

test("All entries in Trends opens the full History log", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator("#history-tab").click();
  await page.locator('[data-history="patterns"]').click();
  await page.locator('[data-act="all-history"]').click();
  await expect(page.locator('[data-history="care"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#story-count")).toContainText("entries");
});

test("Photos switches to Places and back", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator("#photos-tab").click();
  await page.locator('[data-filter="places"]').click();
  await expect(page.locator("#places-view")).toBeVisible();
  await expect(page.locator('[data-filter="places"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#places-home").click();
  await expect(page.locator("#places-view")).toBeHidden();
});

test("a bath makes Winnie shake off, and Memories counts it", async ({
  page,
}, info) => {
  await join(page, code(info));
  await page.locator('[data-act="more"]').click();
  await page.locator('#dialog [data-groom="Bath"]').click();
  await expect(toast(page)).toContainText("Bath logged");
  await page.locator("#photos-tab").click();
  await page.locator('[data-filter="memories"]').click();
  await expect(page.locator("#week-title")).toHaveText("This week");
  await expect(page.locator("#photo-items")).toContainText("First bath logged");
  // the postcard canvas has been drawn
  await expect
    .poll(() =>
      page
        .locator("#postcard")
        .evaluate(
          (c) => c.getContext("2d").getImageData(540, 120, 1, 1).data[3],
        ),
    )
    .toBe(255);
});

test("sheets close by tapping outside them", async ({ page }, info) => {
  await join(page, code(info));
  await page.locator('[data-act="more"]').click();
  await expect(page.locator("#dialog")).toHaveAttribute("open", "");
  await page.mouse.click(10, 10);
  await expect(page.locator("#dialog")).not.toHaveAttribute("open", "");
});

test("a join code adds Kim's phone, and her log shows as a dialogue box", async ({
  browser,
}, info) => {
  const shared = code(info);
  const brandon = await (
    await browser.newContext({ ...info.project.use })
  ).newPage();
  await join(brandon, shared, "brandon");
  await brandon.locator("#settings").click();
  await brandon.locator('[data-act="join-code"]').click();
  const joinCode = (await brandon.locator(".join-code").textContent()).trim();
  expect(joinCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await brandon.locator('[data-act="close"]').click();

  const kim = await (
    await browser.newContext({ ...info.project.use })
  ).newPage();
  await join(kim, joinCode, "kim");
  await expect(kim.locator("#person-name img")).toHaveAttribute("src", /kim-pixel/);
  await kim.locator('#care-actions [data-log="poop"]').click();
  await expect(kim.locator("#sync-status")).toHaveText("Up to date");

  await brandon.locator("#sync-chip").click();
  await brandon.locator('[data-act="sync-now"]').click();
  const box = brandon.locator("#partner-box");
  await expect(box).toBeVisible();
  await expect(box).toContainText("Kim");
  await expect(box).toContainText("Logged poop");
  await box.click();
  await expect(brandon.locator("#dialog-title")).toContainText("Poop");
});

test("dark mode renders without errors", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const errors = await join(page, code(info));
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 20, 58)",
  );
  expect(errors).toEqual([]);
});

test("a log the size of the real one opens and stays responsive", async ({
  page,
}, info) => {
  const errors = await join(page, code(info, "-large"));
  const t = Date.now();
  await page.locator('#care-actions [data-log="pee"]').click();
  await expect(toast(page)).toContainText("Pee logged");
  info.annotations.push({
    type: "pee tap to toast (ms)",
    description: String(Date.now() - t),
  });
  await page.locator("#history-tab").click();
  await expect(page.locator("#story-count")).toContainText("entries");
  await page.locator('[data-history="patterns"]').click();
  await expect(page.locator("#story-items")).toContainText(/poop timing/i);
  expect(errors).toEqual([]);
});
