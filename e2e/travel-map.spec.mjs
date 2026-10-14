import { goPhotos } from './helpers.mjs';
import {test,expect} from '@playwright/test';
import {join,code} from './helpers.mjs';
test.use({serviceWorkers:'block'});

async function travelLog(page,info){
  
  const errors=await join(page,code(info));
  await page.evaluate(async()=>{
    const {sync}=await import('/app/services.js?v=4.26');
    for(const [day,lat,lng] of [['2026-01-01',37.7749,-122.4194],['2026-01-02',37.7749,-122.4194],['2026-01-03',37.7749,-122.4194],['2026-08-14',32.78,-96.8],['2026-08-15',32.78,-96.8]]) {
      const id=crypto.randomUUID();
      await sync.enqueue('create',id,{type:'pee',time:Date.parse(day+'T12:00:00-07:00'),placePin:{lat,lng,accuracy:10,capturedAt:Date.now()}});
      if(day==='2026-08-14') await sync.addPhoto(id,await (await fetch('/photos/winnie-wall.jpg')).blob());
    }
  });
  await goPhotos(page);await page.locator('[data-filter="places"]').click();await expect(page.locator('#travel-map')).toBeVisible();
  return errors;
}
test('travel map groups destinations, replays days, and saves a named trip without duplicating care records',async({page},info)=>{
  const errors=await travelLog(page,info);
  await expect(page.locator('#travel-map')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.travel-intro')).toContainText('California to Texas');
  await page.locator('#travel-map').evaluate(el=>el.dataset.testIdentity='retained');
  await page.locator('[data-travel-scope="US:TX"]').click();
  await expect(page.locator('#travel-map')).toHaveAttribute('data-test-identity','retained');
  await page.locator('.travel-outing',{hasText:'Dallas'}).click();
  await expect(page.locator('.travel-selected')).toContainText('12 months old');
  await page.getByRole('button',{name:'Next recorded day',exact:true}).click();
  await expect(page.locator('.travel-replay')).toContainText('Aug 14, 2026');
  await page.locator('.travel-photo-picker summary').click();
  await page.getByRole('button',{name:'Keep in Winnie',exact:true}).click();
  await expect(page.getByRole('button',{name:'Kept in Winnie',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.travel-selected .travel-photos img')).toHaveCount(1);
  expect(await page.evaluate(async()=>{const {sync}=await import('/app/services.js?v=4.26');return sync.view().events.filter(e=>e.type==='pee').flatMap(e=>e.photos||[]).length;})).toBe(1);
  await page.getByRole('button',{name:'Next recorded day',exact:true}).click();
  await expect(page.locator('.travel-replay')).toContainText('Aug 15, 2026');
  await page.getByRole('button',{name:'Previous recorded day',exact:true}).click();
  await expect(page.locator('.travel-replay')).toContainText('Aug 14, 2026');
  await page.locator('[data-save-outing]').click();await expect(page.locator('#life-form')).toBeVisible();
  await expect(page.locator('#life-form [name="start"]')).toHaveValue('2026-08-14');
  await page.locator('#life-form [name="title"]').fill('Texas with Winnie');
  await page.locator('#life-form button[type="submit"], #life-form button.primary').click();
  await expect(page.locator('#dialog')).not.toBeVisible();
  await expect(page.locator('.travel-outing',{hasText:'Texas with Winnie'})).toHaveCount(1);
  const rows=await page.evaluate(async()=>{const {sync}=await import('/app/services.js?v=4.26');return sync.view().events.filter(e=>!e.deletedAt&&e.tags?.includes('trip-collection')).length;});expect(rows).toBe(1);
  expect(errors).toEqual([]);
});
test('unavailable atlas data leaves the destination directory and source records usable',async({page},info)=>{
  await page.route('**/geo/atlas.json',route=>route.abort());
  const errors=await travelLog(page,info);
  await expect(page.locator('[data-map-status]')).toContainText('background unavailable');
  await page.getByRole('searchbox',{name:'Find a place'}).fill('Dallas');
  await page.locator('.place-city',{hasText:'Dallas'}).click();
  await expect(page.locator('.place-heading')).toContainText('Dallas');
  await expect(page.locator('.place-day')).toHaveCount(2);
  await page.locator('.place-day summary').first().click();await expect(page.locator('.place-day[open] .entry')).toBeVisible();
  await page.getByRole('button',{name:'Back to places',exact:true}).click();await expect(page.getByRole('searchbox',{name:'Find a place'})).toHaveValue('Dallas');
  expect(errors).toEqual([]);
});
