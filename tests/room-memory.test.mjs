import test from 'node:test';
import assert from 'node:assert/strict';
import { graduationMemory } from '../public/room-memory.js';
import { applyCommand, migrate } from '../netlify/lib/core.mjs';
import { project } from '../public/sync.js';

const memory = () => ({ id:'graduation', type:'moment', time:1, milestone:'Canine Good Citizen', photos:[{id:'ribbon-photo'}] });
test('ribbon resolves a unique confirmed milestone, never a caption guess or ambiguous photo', () => {
  const event=memory();
  assert.equal(graduationMemory([event]).event, event);
  assert.equal(graduationMemory([{...event,milestone:undefined,note:'CGC'}]), null);
  assert.equal(graduationMemory([event,{...event,id:'other'}]), null);
  assert.equal(graduationMemory([{...event,photos:[...event.photos,{id:'other'}]}]), null);
  assert.equal(graduationMemory([{...event,deletedAt:1}]), null);
});
test('explicit ribbon binding preserves the original entry and does not silently replace missing memories', () => {
  const event=memory(), profile={cgcMemory:{eventId:event.id,photoId:'ribbon-photo'}};
  assert.equal(graduationMemory([event],profile).photo, event.photos[0]);
  assert.equal(graduationMemory([{...event,photos:[]}],profile),null);
  assert.equal(graduationMemory([{...event,id:'another'}],profile),null);
});
test('shared ribbon binding validates live photo ownership and supports offline projection', () => {
  const doc=migrate({events:[memory()]}), device={id:'test',person:'brandon'};
  const command=(id,link,revision=doc.profile.revision)=>({protocol:4,operationId:id,kind:'profile',expectedRevision:revision,payload:{cgcMemory:link}});
  const link={eventId:'graduation',photoId:'ribbon-photo'};
  const pending=command('pending',link);
  assert.deepEqual(project({snapshot:doc,queue:[{person:'brandon',command:pending}]}).profile.cgcMemory,link);
  applyCommand(doc,pending,device);
  assert.deepEqual(doc.profile.cgcMemory,link);
  assert.equal(doc.events.length,1);
  assert.throws(()=>applyCommand(doc,command('missing',{...link,photoId:'missing'}),device),/no longer available/);
  assert.throws(()=>applyCommand(doc,command('invalid',null),device),/Choose a saved/);
  assert.throws(()=>applyCommand(doc,command('conflict',link,0),device),/changed/);
  doc.events[0].deletedAt=1;
  assert.throws(()=>applyCommand(doc,command('deleted',link),device),/no longer available/);
});
test('closet selections are shared, validate known outfits, and do not create care records', () => {
  const doc=migrate({events:[]}), device={id:'test',person:'brandon'};
  for(const outfit of ['stripes','harness','bandanna']) {
    applyCommand(doc,{protocol:4,operationId:outfit,kind:'profile',expectedRevision:doc.profile.revision,payload:{roomOutfit:outfit}},device);
    assert.equal(doc.profile.roomOutfit,outfit);
  }
  assert.throws(()=>applyCommand(doc,{protocol:4,operationId:'bad',kind:'profile',expectedRevision:doc.profile.revision,payload:{roomOutfit:'invalid'}},device),/available outfit/);
  assert.equal(doc.events.length,0);
});
