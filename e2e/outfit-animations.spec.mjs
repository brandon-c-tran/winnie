import {test,expect} from '@playwright/test';
import {code,join} from './helpers.mjs';

async function setup(page,info) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  const errors=await join(page,code(info));
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const original=CanvasRenderingContext2D.prototype.drawImage;
    window.outfitDraws=[];
    CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
      if(/winnie-(harness|stripes|room)-v\d/.test(img?.src||'')) {
        window.outfitDraws.push({src:img.src,x:args[0],y:args[1]});
        if(window.outfitDraws.length>200)window.outfitDraws.shift();
      }
      return original.call(this,img,...args);
    };
  });
  return errors;
}

for(const outfit of ['harness','stripes']) {
  test(`${outfit} renders the complete animation grid without substituting sitting`,async({page},info)=>{
    const errors=await setup(page,info);
    const failures=await page.evaluate(async(outfit)=>{
      const {room}=await import('/app/services.js?v=4.30');
      const {FRAMES}=await import('/room.js?v=4.30');
      room.set({outfit,sleep:null,walk:false},{instant:true});room.pause(true);
      const failures=[];
      for(const [pose,coords] of Object.entries(FRAMES)){
        // Sleep always rests on the plush; wag and sit include their idle cycle.
        const frames=pose==='sleep'?[FRAMES.sleepToy]:pose==='wag'?[FRAMES.wag,FRAMES.sit]:pose==='sit'?[FRAMES.sit,FRAMES.blink]:[coords];
        window.outfitDraws=[];room.place(100,pose);room.draw();
        if(!window.outfitDraws.some(d=>d.src.endsWith(`winnie-${outfit}-v2.png`)&&frames.some(([col,row])=>d.x===col*64&&d.y===row*64)))failures.push(pose);
      }
      return failures;
    },outfit);
    expect(failures).toEqual([]);expect(errors).toEqual([]);
  });
  test(`${outfit} fetches, carries and naps with Snuggle Puppy, then puts it back`,async({page},info)=>{
    test.setTimeout(45000);
    const errors=await setup(page,info);
    await page.evaluate(async(outfit)=>{
      const {room}=await import('/app/services.js?v=4.30');
      room.set({outfit,sleep:null,walk:false},{instant:true});room.react('toy');
    },outfit);
    const pose=()=>page.evaluate(async()=>{const {room}=await import('/app/services.js?v=4.30');return {pose:room.dog.pose,toy:room.dog.toy,outfit:room.outfit};});
    await expect.poll(pose,{timeout:15000,intervals:[50]}).toEqual({pose:'carry',toy:true,outfit});
    expect(await page.evaluate(outfit=>window.outfitDraws.some(d=>d.src.endsWith(`winnie-${outfit}-v2.png`)&&d.y===576),outfit)).toBe(true);
    await expect.poll(pose,{timeout:15000,intervals:[50]}).toEqual({pose:'sleepToy',toy:true,outfit});
    await expect.poll(async()=>(await pose()).toy,{timeout:15000,intervals:[50]}).toBe(false);
    expect((await pose()).outfit).toBe(outfit);expect(errors).toEqual([]);
  });
}

test('sleep interruption and reduced motion preserve clothes and clear toy carrying',async({page},info)=>{
  await setup(page,info);
  await page.evaluate(async()=>{const {room}=await import('/app/services.js?v=4.30');room.set({outfit:'stripes',sleep:null,walk:false},{instant:true});room.react('toy');});
  await expect.poll(()=>page.evaluate(async()=>(await import('/app/services.js?v=4.30')).room.dog.toy),{timeout:15000}).toBe(true);
  await page.evaluate(async()=>{const {room}=await import('/app/services.js?v=4.30');room.set({sleep:'slumber'},{instant:true});});
  expect(await page.evaluate(async()=>{const {room}=await import('/app/services.js?v=4.30');return {toy:room.dog.toy,outfit:room.outfit};})).toEqual({toy:false,outfit:'stripes'});
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(async()=>{const {room}=await import('/app/services.js?v=4.30');room.set({sleep:null,outfit:'harness'},{instant:true});room.react('toy');return {toy:room.dog.toy,outfit:room.outfit};})).toEqual({toy:false,outfit:'harness'});
});
