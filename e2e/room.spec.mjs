import { test, expect } from '@playwright/test';
import { code, join } from './helpers.mjs';

test('potty harness returns to bandanna and yields to sleep, replacement and reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await join(page, code(info));
  // Font loading and the deferred ResizeObserver both settle the room. Start
  // the sequence after that initial layout, not during a preference-change event.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(() => page.locator('#room').evaluate(c => Math.abs(c.getBoundingClientRect().width-c.parentElement.clientWidth))).toBeLessThan(1);
  const outfit = () => page.evaluate(async () => (await import('/app/services.js?v=4.27')).room.dog.harness);
  const react = kind => page.evaluate(async kind => {
    const {room}=await import('/app/services.js?v=4.27');
    room.set({sleep:null,walk:false},{instant:true});
    room.react(kind);
  },kind);
  await react('pee');
  await expect.poll(outfit).toBe(true);
  await expect.poll(outfit,{timeout:12000}).toBe(false);
  await react('poop');
  await expect.poll(outfit).toBe(true);
  await page.evaluate(async()=>{
    const {room}=await import('/app/services.js?v=4.27');
    room.set({sleep:'slumber'});
  });
  await expect.poll(outfit).toBe(false);
  await react('pee');
  await expect.poll(outfit).toBe(true);
  await page.evaluate(async()=> (await import('/app/services.js?v=4.27')).room.react('meal'));
  await expect.poll(outfit).toBe(false);
  await react('pee');
  await expect.poll(outfit).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(outfit).toBe(false);
  await react('poop');
  expect(await outfit()).toBe(false);
  expect(errors).toEqual([]);
});

test('room lights brighten a sleeping room, remember the choice, and leave care intact', async ({ page }, info) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({json:{current:{temperature_2m:65,weather_code:0,cloud_cover:0}}}));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await join(page, code(info));
  await page.evaluate(async () => {
    const { room } = await import('/app/services.js?v=4.27');
    room.pause(true);
    room.set({ epoch: Date.parse('2026-10-13T23:00:00-07:00'), sleep: 'slumber' }, { instant: true });
  });
  const sample = () => page.evaluate(async () => {
    const { room, sync } = await import('/app/services.js?v=4.27');
    const c = document.querySelector('#room'), k = c.height / 112, ctx = c.getContext('2d');
    const at = (x,y) => [...ctx.getImageData(Math.floor(x*k), Math.floor(y*k),1,1).data].slice(0,3).reduce((a,b)=>a+b,0)/3;
    return { wall: at(30,55), sky: at(50,20), pose: room.dog.pose, count: sync.view().events.length };
  });
  const before = await sample();
  const lights = page.getByRole('button', { name: 'Room lights', exact: true });
  // The target must follow the HUD inset without waiting for canvas measurement.
  await page.locator('#room-wrap').evaluate(el=>el.style.setProperty('--room-hud-height','84px'));
  expect(await page.evaluate(async()=>{
    const {room}=await import('/app/services.js?v=4.27');
    const canvas=document.querySelector('#room').getBoundingClientRect(),button=document.querySelector('#room-lights').getBoundingClientRect(),s=room.layout.lightSwitch;
    return Math.abs(button.y+button.height/2-(canvas.y+(s.y+s.h/2)*canvas.height/112));
  })).toBeLessThan(1);
  await page.locator('#room-wrap').evaluate(el=>el.style.removeProperty('--room-hud-height'));
  await expect(lights).toHaveAttribute('aria-pressed', 'false');
  await lights.click();
  await expect(lights).toHaveAttribute('aria-pressed', 'true');
  const after = await sample();
  expect(after.wall).toBeGreaterThan(before.wall + 60);
  expect(after.sky).toBeLessThan(100);
  expect(after.pose).toBe(before.pose);
  expect(after.count).toBe(before.count);
  await page.reload();
  await expect(lights).toHaveAttribute('aria-pressed', 'true');
  await lights.focus();
  await page.keyboard.press('Space');
  await expect(lights).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(lights).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('larger wall photo remains selectable at narrow phone widths', async ({ page }, info) => {
  await page.setViewportSize({width:320, height:740});
  const errors = await join(page, code(info));
  // The room is first created while Today is hidden. Wait for its deferred
  // ResizeObserver pass before converting an art coordinate into a real tap.
  await expect.poll(() => page.locator('#room').evaluate(canvas =>
    Math.abs(canvas.getBoundingClientRect().width - canvas.parentElement.clientWidth)
  )).toBeLessThan(1);
  const point = await page.evaluate(async () => {
    const { room } = await import('/app/services.js?v=4.27');
    const { frame, door } = room.layout;
    const canvas = document.querySelector('#room'), rect = canvas.getBoundingClientRect();
    const scale = rect.height / 112;
    return { x: (frame.x + frame.w/2)*scale, y: (frame.y + frame.h/2)*scale, width:frame.w, height:frame.h, fits:frame.x+frame.w<door.x };
  });
  expect(point.width).toBeGreaterThan(22);
  expect(point.height).toBeGreaterThan(18);
  expect(point.fits).toBe(true);
  await page.locator('#room').click({position:{x:point.x,y:point.y}});
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dialog')).toContainText('Photo on his wall');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
