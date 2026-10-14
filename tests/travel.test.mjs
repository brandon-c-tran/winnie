import test from 'node:test';
import assert from 'node:assert/strict';
import {travelAtlas} from '../public/travel.js';
import {createCityLookup} from '../public/places.js';

const cities=createCityLookup([['sf','San Francisco',37.77,-122.42,'US','CA'],['d','Dallas',32.78,-96.8,'US','TX']]);
const row=(id,day,lat=37.77,lng=-122.42)=>({id,type:'pee',time:Date.parse(day+'T18:00Z'),placePin:{lat,lng},photos:[]});
test('travel groups repeated care evidence into days and labels inferred outings without inventing routes',()=>{
  const events=[row('home1','2026-01-01'),row('home2','2026-01-02'),row('home3','2026-01-03'),row('away1','2026-08-14',32.78,-96.8),row('away2','2026-08-14',32.78,-96.8),row('away3','2026-08-15',32.78,-96.8)];
  const a=travelAtlas(events,cities,Date.parse('2026-10-01'));
  assert.equal(a.base.name,'San Francisco');assert.equal(a.mapped.length,2);assert.equal(a.outings.length,1);
  assert.equal(a.outings[0].days.length,2);assert.equal(a.outings[0].inferred,true);assert.equal(a.outings[0].age,'12 months old');
  assert.equal(a.mapped.find(g=>g.name==='Dallas').sources.length,3);
  assert.equal(JSON.stringify(a).includes('miles'),false);
});
test('photo location and capture date contribute independently while removed pins and unselected care photos stay respected',()=>{
  const e=row('care','2026-09-20');e.photos=[{id:'p',keepsake:true,metadata:{capturedAt:Date.parse('2025-12-25T01:00Z'),wall:'2025-12-24T19:00',timezone:'America/Chicago',pin:{lat:32.78,lng:-96.8}}},{id:'private',metadata:{capturedAt:Date.parse('2025-12-25T01:00Z'),wall:'2025-12-24T19:00',pin:{lat:32.78,lng:-96.8}}},{id:'removed',keepsake:true,metadata:{pin:null,location:''}}];
  const a=travelAtlas([e],cities,Date.parse('2026-10-01')),d=a.mapped.find(g=>g.name==='Dallas');
  assert.equal(d.firstDay,'2025-12-24');assert.equal(d.photos.length,1);assert.equal(d.photos[0].photo.id,'p');assert.equal(d.sources[0].id,'care');
  assert.equal(e.time,Date.parse('2026-09-20T18:00Z'));
  const oldYear=travelAtlas([e],cities,Date.parse('2026-10-01'),'2025');
  assert.equal(oldYear.mapped.length,1);assert.equal(oldYear.mapped[0].name,'Dallas');
});
test('saved trip replaces covered suggestion; deleted, diagnostic and future entries do not add destinations',()=>{
  const events=[row('h1','2026-01-01'),row('h2','2026-01-02'),row('d','2026-08-14',32.78,-96.8),{id:'trip',type:'moment',note:'Texas birthday visit',time:Date.parse('2026-08-14T07:00Z'),end_time:Date.parse('2026-08-18T06:59Z'),tags:['trip-collection']}];
  const a=travelAtlas(events,cities,Date.parse('2026-10-01'));assert.equal(a.outings.length,1);assert.equal(a.outings[0].inferred,false);assert.equal(a.outings[0].name,'Texas birthday visit');
  const hidden=travelAtlas([{...row('x','2026-08-15'),deletedAt:1},{...row('y','2026-08-15'),analysisExcluded:true},row('z','2027-01-01')],cities,Date.parse('2026-10-01'));assert.equal(hidden.mapped.length,0);
});

test('saved trip includes selected locationless photos on their capture days without inventing map pins',()=>{
  const trip={id:'trip',type:'moment',note:'Texas memories',time:Date.parse('2025-12-23T08:00Z'),end_time:Date.parse('2025-12-27T07:59Z'),tags:['trip-collection']};
  const photo={id:'photo',type:'poop',time:Date.parse('2026-09-20T18:00Z'),photos:[
    {id:'keep',keepsake:true,metadata:{capturedAt:Date.parse('2025-12-25T01:00Z'),wall:'2025-12-24T19:00',timezone:'America/Chicago',pin:null,location:''}},
    {id:'care-only',metadata:{capturedAt:Date.parse('2025-12-25T01:00Z'),wall:'2025-12-24T19:00'}},
  ]};
  const a=travelAtlas([trip,photo],cities,Date.parse('2026-10-01'),'2025');
  assert.equal(a.mapped.length,0);
  assert.deepEqual(a.outings[0].days,['2025-12-24']);
  assert.deepEqual(a.outings[0].photos.map(p=>p.photo.id),['keep']);
  assert.deepEqual(a.outings[0].groups,[]);
});
