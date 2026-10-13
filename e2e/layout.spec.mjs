import { test, expect } from "@playwright/test";
import { code, join } from "./helpers.mjs";

// The page must never scroll sideways, in any state. On failure this lists the elements
// that stick out past the right edge so the culprit is obvious.
async function noSideways(page, state) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).position === "fixed") continue;
      // ignore content inside an intentional horizontal scroller
      let p = el.parentElement,
        clipped = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (
          ox === "auto" ||
          ox === "scroll" ||
          ox === "hidden" ||
          ox === "clip"
        ) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped && (r.right > vw + 0.5 || r.left < -0.5))
        offenders.push(
          `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${[...el.classList].join(".")} [${Math.round(r.left)}..${Math.round(r.right)}]`,
        );
    }
    return {
      scroll: document.documentElement.scrollWidth - vw,
      offenders: offenders.slice(0, 8),
    };
  });
  expect(result, `sideways overflow in: ${state}`).toEqual({
    scroll: 0,
    offenders: [],
  });
}

test("no state scrolls sideways", async ({ page }, info) => {
  await join(page, code(info));
  await noSideways(page, "Today");
  await page.locator('#care-actions [data-log="pee"]').click();
  await noSideways(page, "toast after a log");
  for (const [open, label] of [
    ['[data-act="more"]', "More sheet"],
    ['[data-act="earlier"]', "Earlier sheet"],
    ['#log-row [data-log="meal"]', "Meal sheet"],
    ["#settings", "Settings"],
    ["#sync-chip", "Sync sheet"],
  ]) {
    await page.locator(open).first().click();
    await expect(page.locator("#dialog")).toHaveAttribute("open", "");
    await noSideways(page, label);
    await page.locator("#dialog-close").click();
    await expect(page.locator("#dialog")).not.toHaveAttribute("open", "");
  }
  await page.locator('[data-act="more"]').click();
  await page.locator('[data-act="start-walk"]').click();
  await expect(page.locator("#room-status")).toContainText("Out on a walk");
  await noSideways(page, "walk running");
  await page.locator('[data-act="more"]').click();
  await page.locator('[data-act="start-sleep"]').click();
  await noSideways(page, "sleep running");
  for (const [tab, label] of [
    ["#plans-tab", "Plans"],
    ["#history-tab", "History"],
    ['[data-history="patterns"]', "Trends"],
    ["#photos-tab", "Photos"],
    ['[data-filter="places"]', "Places"],
    ['[data-filter="memories"]', "Memories"],
  ]) {
    await page.locator(tab).click();
    await noSideways(page, label);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator("#today-tab").click();
  await noSideways(page, "dark Today");
});
