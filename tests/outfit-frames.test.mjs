import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decode } from '../scripts/png.mjs';
import { FRAMES } from '../public/room.js';

for(const outfit of ['harness','stripes']) {
  test(`${outfit} has real artwork for every room animation and preserves its released base poses`,()=>{
    const sheet=decode(fs.readFileSync(`public/photos/winnie-${outfit}-v2.png`));
    const prior=decode(fs.readFileSync(`public/photos/winnie-${outfit}-v1.png`));
    assert.equal(sheet.w,192);assert.equal(sheet.h,640);
    assert.deepEqual(sheet.px.subarray(0,prior.px.length),prior.px);
    const cells=new Map();
    for(const [name,[col,row]] of Object.entries(FRAMES)) {
      const pixels=[];let opaque=0;
      for(let y=0;y<64;y++)for(let x=0;x<64;x++) {
        const at=((row*64+y)*sheet.w+col*64+x)*4;
        pixels.push(...sheet.px.subarray(at,at+4));
        if(sheet.px[at+3])opaque++;
      }
      assert.ok(opaque>200,`${name} must have visible artwork`);
      cells.set(name,Buffer.from(pixels));
    }
    for(const name of ['toyA','toyB','sleepToy','eatA','scratchA','roll','jump'])
      assert.notDeepEqual(cells.get(name),cells.get('sit'),`${name} must not substitute sitting`);
    assert.notDeepEqual(cells.get('toyA'),cells.get('toyB'),'carrying must animate');
  });
}
