import { test, expect } from '@playwright/test';
import { join, code } from './helpers.mjs';

test('ribbon opens a full photo, saves a shared recollection and survives reload', async ({page},info)=>{
  const errors=await join(page,code(info));
  await page.evaluate(async()=>{
    const {sync}=await import('/app/services.js?v=4.28');
    await sync.enqueue('create','graduation',{type:'moment',time:Date.parse('2026-08-15T12:00:00-07:00'),time_precision:'date',timezone:'America/Los_Angeles',note:'His big day',milestone:'Canine Good Citizen',retroactive:true});
    await sync.addPhoto('graduation',await(await fetch('/photos/winnie-wall.jpg')).blob());
  });
  await expect(page.locator('#sync-status')).toHaveText('Up to date');
  await page.locator('#room-ribbon').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.graduation-memory')).toContainText('August 15, 2026');
  await expect(page.locator('.graduation-memory')).toContainText('12 months old');
  await expect.poll(()=>page.locator('.graduation-photo').evaluate(i=>i.naturalWidth>0)).toBe(true);
  expect(await page.locator('.graduation-photo').evaluate(i=>getComputedStyle(i).objectFit)).toBe('contain');
  await page.locator('#cgc-remember').click();
  await page.locator('#recollection-form textarea').fill('So proud of him! <b>Our boy</b>');
  await page.getByRole('button',{name:'Save recollection',exact:true}).click();
  await expect(page.locator('.graduation-memory')).toContainText('So proud of him! <b>Our boy</b>');
  await expect(page.locator('.graduation-memory .remembered-words b')).toHaveCount(0);
  await expect(page.locator('#sync-status')).toHaveText('Up to date');
  await page.locator('#cgc-choose').click();
  await page.locator('[data-memory-choice]').click();
  await expect(page.locator('.graduation-memory')).toBeVisible();
  await expect(page.locator('#sync-status')).toHaveText('Up to date');
  await page.reload();
  await page.locator('#room-ribbon').click();
  await expect(page.locator('.graduation-memory')).toContainText('Brandon remembers');
  await page.setViewportSize({width:320,height:740});
  expect(await page.locator('#dialog').evaluate(d=>d.scrollWidth>d.clientWidth)).toBe(false);
  await page.locator('#dialog-close').click();
  await expect(page.locator('#dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('unlinked ribbon offers setup without creating a made-up graduation',async({page},info)=>{
  await join(page,code(info));
  await page.locator('#room-ribbon').click();
  await expect(page.getByRole('button',{name:'Choose graduation photo',exact:true})).toBeVisible();
  await expect(page.locator('.graduation-photo')).toHaveCount(0);
  await page.getByRole('button',{name:'Choose graduation photo',exact:true}).click();
  await expect(page.locator('#memory-picker-count')).toContainText('No photos match');
  expect(await page.evaluate(async()=>{const {facts}=await import('/app/services.js?v=4.28');return facts().filter(e=>e.milestone==='Canine Good Citizen').length;})).toBe(0);
});
