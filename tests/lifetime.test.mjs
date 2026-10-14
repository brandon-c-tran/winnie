import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataFromTags, wallInstants } from '../public/photo-metadata.js';
import { validatePhotoMetadata } from '../public/photo-fields.js';
import { stageNotes } from '../scripts/notes-import.mjs';
import { toileting, selectedPhotos, comparePeriods, answerRecords, ageAt } from '../public/lifetime.js';
import { migrate, applyCommand } from '../netlify/lib/core.mjs';
import { latestCare } from '../public/care-state.js';

test('photo clocks preserve explicit camera offsets and infer GPS zones only when unambiguous',()=>{
  const m=metadataFromTags({DateTimeOriginal:'2025:12:24 23:30:00',OffsetTimeOriginal:'-06:00',latitude:32.91,longitude:-96.64});
  assert.equal(m.capturedAt,Date.parse('2025-12-25T05:30:00Z'));
  assert.equal(m.wall,'2025-12-24T23:30');assert.equal(m.timezone,'America/Chicago');
  assert.equal(metadataFromTags({DateTimeOriginal:'2025:12:24 23:30:00'}).capturedAt,null);
  assert.equal(metadataFromTags({DateTimeOriginal:'2025:12:24 23:30:00',latitude:32.91,longitude:-96.64}).capturedAt,m.capturedAt);
  assert.equal(metadataFromTags({DateTimeOriginal:'2025:02:31 23:30:00',OffsetTimeOriginal:'-06:00'}).capturedAt,null);
  assert.equal(wallInstants('2025-11-02T01:30','America/Los_Angeles').length,2);
  assert.equal(wallInstants('2026-03-08T02:30','America/Los_Angeles').length,0);
  assert.equal(wallInstants('2025-12-24T23:30','not/a/zone').length,0);
  assert.throws(()=>validatePhotoMetadata({pin:{lat:100,lng:0}}));
});
test('selected care photos use capture date and place without moving the care entry',()=>{
  const event={id:'care',type:'poop',time:Date.parse('2026-10-13T12:00Z'),photos:[{id:'photo',keepsake:true,metadata:{capturedAt:Date.parse('2025-12-25T05:30Z'),wall:'2025-12-24T23:30',location:'Garland'}}]};
  const photo=selectedPhotos([event])[0];assert.equal(photo.day,'2025-12-24');assert.equal(photo.location,'Garland');assert.equal(event.time,Date.parse('2026-10-13T12:00Z'));
});
test('indoor does not mean accident, absent settings stay unknown, and uncertain accidents stay unknown',()=>{
  assert.deepEqual(toileting({note:'🟨 indoors'}),{setting:'indoor',accident:null});
  assert.deepEqual(toileting({note:'🟨 outdoors ⛔️'}),{setting:'outdoor',accident:true});
  assert.deepEqual(toileting({note:'🟨 /⛔️?'}),{setting:'unknown',accident:null});
  assert.equal(ageAt('2025-10-06'),'10 weeks old');
});
test('comparisons require coverage in the same era and answers cite original IDs',()=>{
  const month=(prefix,n)=>Array.from({length:n},(_,i)=>({id:prefix+i,type:'pee',time:Date.parse(`${prefix}-${String(i+1).padStart(2,'0')}T12:00Z`),note:'Will outside'}));
  const events=[...month('2026-06',28),...month('2026-07',28),...month('2025-12',28)];
  assert.equal(comparePeriods(events,'2026-06','2026-07').comparable,true);
  assert.equal(comparePeriods(events,'2025-12','2026-07').comparable,false);
  assert.equal(comparePeriods(events,'2026-06','2026-08').comparable,false);
  assert.equal(answerRecords(events,'first pee with Will').events[0].id,'2025-120');
  assert.equal(answerRecords(events,'first unicorn').events.length,0);
});
test('Notes import is deterministic, preserves sources, handles overnight and leaves unknown clocks uncertain',()=>{
  const rows=[['2025-12-22','8:30','Slumber'],['2025-12-22','1:05am','Potty'],['2025-12-23','7:00','Wake up'],['2025-12-23','7:05','🟨💩 outdoors'],['2026-02-07','6:66','🟨/⛔️'],['2026-01-30','2:26','🟨 indoors'],['2026-02-08','-','🚊'],['2026-02-08','2:00','Crate'],['2026-02-08','3:00','Potty?']].map(([day,timeText,text],i)=>({sourceId:'f:'+i,file:'f',line:i,raw:timeText+'\t'+text,header:day,proposedDate:day,context:'dated',timeText,text,flags:[]}));
  const ledger={rows,days:[],manifest:[]},a=stageNotes(ledger),b=stageNotes(ledger);
  assert.deepEqual(a,b);
  assert.equal(a.events.find(e=>e.note==='Potty').provenance.calendarDate,'2025-12-23');
  assert.equal(a.events.find(e=>e.note==='🟨💩 outdoors').timezone,'America/Chicago');
  assert.equal(a.events.find(e=>e.note==='🟨/⛔️').time_precision,'date');
  assert.equal(a.events.find(e=>e.provenance.sourceDate==='2026-01-30').time_precision,'date');
  assert.equal(a.events.find(e=>e.note==='🚊').type,'enrichment');
  assert.equal(a.events.find(e=>e.note==='Crate').type,'note');
  assert.equal(a.events.find(e=>e.note==='Potty?').type,'note');
  assert.equal(a.events.filter(e=>e.note==='🟨💩 outdoors').length,2);
  assert.equal(a.events[0].provenance.raw,rows[0].raw);
});
test('historical open sleep never blocks or replaces a live timer; photo metadata survives server commands',()=>{
  const now=Date.now()-60000,device={id:'phone',person:'brandon'};
  const doc=migrate({events:[{id:'old',type:'slumber',time:now-86400000,historical:true,end_time:null}]});
  applyCommand(doc,{protocol:4,operationId:'start',kind:'create',eventId:'new',payload:{type:'nap',time:now}},device);
  assert.equal(latestCare(doc.events).sleep.id,'new');
  const metadata={capturedAt:now-5000,wall:'2026-01-01T10:00',pin:{lat:37,lng:-122}};
  applyCommand(doc,{protocol:4,operationId:'attach',kind:'attach',eventId:'new',expectedRevision:1,payload:{photoId:'photo',metadata}},device);
  assert.deepEqual(doc.events.find(e=>e.id==='new').photos[0].metadata,metadata);
});
