import {test, expect} from '@playwright/test';
import {code, join, goTimeline} from './helpers.mjs';

test('Story shares photos and records, preserves exploration and gives Insights its own destination', async ({page}, info) => {
  const errors = await join(page, code(info));
  await page.locator('#story-tab').click();
  await expect(page.locator('#story-title')).toHaveText('Story');
  await expect(page.locator('#tabbar button')).toHaveText(['Today','Plans','Story','Insights']);
  await page.locator('#story-add').click();
  await page.locator('[data-album-library]').click();
  await page.locator('#library-input').setInputFiles('public/photos/winnie-smile.png');
  await page.locator('#photo-composer [name="note"]').fill('A day at the beach');
  await page.locator('[data-photo-field="wall"]').fill('2026-01-10T10:30');
  await page.locator('[data-photo-field="timezone"]').selectOption('America/Los_Angeles');
  await page.locator('#photo-composer [type="submit"]').click();
  await expect(page.locator('#dialog')).toBeHidden();
  await page.locator('#story-search').fill('beach');
  await expect(page.locator('#story-count')).toHaveText('1 entry');
  await expect(page.locator('#story-items .record-photo img')).toHaveAttribute('src', /blob:/);
  const id = await page.locator('#story-items .record-photo').getAttribute('data-open');
  await page.locator('#places-home').click();
  await expect(page.locator(`#photo-items [data-open="${id}"]`)).toBeVisible();
  await page.locator('#photo-search').fill('beach');
  await page.locator('#insights-tab').click();
  await expect(page.locator('#story-title')).toHaveText('Insights');
  await expect(page.locator('#story-navigation')).toBeHidden();
  await expect(page.locator('#story-add')).toBeHidden();
  await expect(page.locator('#pattern-window')).toBeVisible();
  await page.locator('#story-tab').click();
  await expect(page.locator('#places-home')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#photo-search')).toHaveValue('beach');
  await page.locator('[data-filter="memories"]').click();
  await page.locator('[data-history="lifetime"]').click();
  await expect(page.locator('#life-month')).toBeVisible();
  await expect(page.locator('[data-filter="memories"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#today-tab').click();
  await page.locator('#story-tab').click();
  await expect(page.locator('#life-month')).toBeVisible();
  await goTimeline(page);
  await expect(page.locator('#story-search')).toHaveValue('beach');
  await expect(page.locator('#story-count')).toHaveText('1 entry');
  await page.locator('[data-history="calendar"]').click();
  await expect(page.locator('[data-story="care"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#story-tab')).toHaveAttribute('aria-current','page');
  // Compatibility route used by care shortcuts must preserve Story's section.
  for (const section of ['calendar', 'lifetime']) {
    if (section === 'lifetime') {
      await page.locator('[data-filter="memories"]').click();
      await page.locator('[data-history="lifetime"]').click();
    }
    await page.locator('#today-tab').click();
    await page.evaluate(() => {
      const shortcut = document.createElement('button');
      shortcut.dataset.careNav = 'patterns';
      document.body.append(shortcut);
      shortcut.click();
      shortcut.remove();
    });
    await expect(page.locator('#insights-tab')).toHaveAttribute('aria-current', 'page');
    await page.locator('#story-tab').click();
    await expect(page.locator(`[data-history="${section}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  expect(errors).toEqual([]);
});
