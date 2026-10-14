import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeTimeline } from '../public/life-timeline.js';

const event = (id, day, more = {}) => ({id, type:'moment', time:Date.parse(day+'T12:00:00-07:00'), timezone:'America/Los_Angeles', ...more});
test('life chronology follows photo capture dates, keeps original sources, and excludes unselected care and deleted records', () => {
  const care = event('care','2026-10-14',{type:'poop',photos:[{id:'selected',keepsake:true,metadata:{wall:'2025-12-24T23:30',capturedAt:Date.parse('2025-12-25T05:30Z'),location:'Garland'}},{id:'private',keepsake:false}]});
  const rows = lifeTimeline([care,event('gone','2025-09-01',{deletedAt:1,photos:[{id:'gone'}]}),event('routine','2025-09-02',{type:'pee'})], '2026-10-14');
  assert.deepEqual(rows.map(r=>r.day),['2025-07-25','2025-10-04','2025-12-24']);
  assert.equal(rows[2].photos[0].event,care);
  assert.equal(rows[2].photos[0].location,'Garland');
  assert.equal(rows[2].photos.length,1);
  assert.equal(care.time,Date.parse('2026-10-14T12:00:00-07:00'));
});
test('life chronology includes saved milestones, trips and recollections without inventing trips from routine records', () => {
  const rows = lifeTimeline([event('trip','2026-01-01',{tags:['trip-collection'],note:'Texas',end_time:Date.parse('2026-01-05T12:00Z')}),event('award','2026-05-01',{milestone:'Canine Good Citizen'}),event('note','2025-10-05',{note:'First cuddle'}),event('diagnostic','2025-10-06',{tags:['_diagnostic'],note:'Ignore'})], '2026-10-14');
  assert.equal(rows.find(r=>r.day==='2026-01-01').landmarks[0].trip,true);
  assert.equal(rows.find(r=>r.day==='2026-05-01').landmarks[0].id,'award');
  assert.equal(rows.find(r=>r.day==='2025-10-05').moments[0].note,'First cuddle');
  assert.equal(rows.some(r=>r.day==='2025-10-06'),false);
});
test('large photo libraries retain every distinct selected image and stable chronology', () => {
  const photos=Array.from({length:1000},(_,i)=>({id:'photo-'+i}));
  const rows=lifeTimeline([event('many','2026-01-01',{photos}),event('duplicate','2026-01-01',{photos:[photos[0]]})],'2026-10-14');
  assert.equal(rows.at(-1).photos.length,1000);
});
