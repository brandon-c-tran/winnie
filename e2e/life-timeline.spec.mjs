import {test,expect} from '@playwright/test';
import {join,code} from './helpers.mjs';

test('Life scrolls through photo days, jumps by age, and preserves source memories and album tools', async ({page},info)=>{
  const errors=await join(page,code(info));
  await page.evaluate(async()=>{
    const {sync}=await import('/app/services.js?v=4.26');
    const blob=await(await fetch('/photos/winnie-wall.jpg')).blob();
    for(let i=0;i<12;i++) {
      const day=`2025-${i<6?'10':'11'}-${String(i%6+4).padStart(2,'0')}`,time=Date.parse(day+'T12:00:00-08:00');
      await sync.enqueue('create','life-'+i,{type:'moment',time,note:'A remembered day '+i,timezone:'America/Los_Angeles',retroactive:true});
      await sync.addPhoto('life-'+i,blob,{capturedAt:time,wall:day+'T12:00',timezone:'America/Los_Angeles',origin:'manual'});
    }
  });
  await page.locator('#story-tab').click();
  await expect(page.locator('.life-day')).toHaveCount(8);
  await expect(page.locator('#album-title')).toHaveCount(0);
  await expect(page.locator('.life-age').first()).toHaveText('His first weeks');
  await expect.poll(()=>page.locator('.life-photo img').first().evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await page.locator('#life-continue').scrollIntoViewIfNeeded();
  await expect(page.locator('.life-day')).toHaveCount(13);
  await page.locator('#life-jump').selectOption({label:'3 months old'});
  await expect(page.locator('#life-day-2025-11-04')).toBeInViewport();
  await page.locator('#life-latest').click();
  await expect(page.locator('#life-day-2025-11-09')).toBeInViewport();
  const photo=page.locator('#life-day-2025-11-09 .life-photo');
  await photo.scrollIntoViewIfNeeded();
  const position=await page.evaluate(()=>scrollY);
  await photo.click();
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog-close').click();
  expect(Math.abs(await page.evaluate(()=>scrollY)-position)).toBeLessThan(10);
  await page.locator('#life-yearbook').click();
  await expect(page.locator('#album-title')).toBeVisible();
  await page.setViewportSize({width:320,height:740});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
