// Evidence-based views over Winnie's records. Missing logs never mean no activity.
import { cityFor, placeName } from './places.js?v=4.26';
import { winniePhotos } from './keepsakes.js?v=4.26';
export const BIRTHDAY = '2025-07-25';
export const HOMECOMING = '2025-10-04';
export const ERAS = [
  ['2025-10-06','Early Notes','Activity names, sleep starts and ends, and detailed observations.'],
  ['2025-12-01','Compact Notes','Emoji, sleep ranges and indoor/outdoor annotations. November is missing.'],
  ['2026-01-26','Shorter Notes','Outdoor labels become less frequent. Missing labels remain unknown.'],
  ['2026-02-21','Minimal Notes','Mostly bare bathroom symbols. Location comparisons are limited.'],
  ['2026-04-30','App logging','First sustained full days in the app.'],
  ['2026-09-09','Richer app records','Food names, photos and place pins. Newer fields have shorter histories.'],
];
const dayFormats=new Map(), dayCache=new Map();
export function recordDay(e) {
  const m=e.type === "moment" && e.photos?.length === 1 ? e.photos[0].metadata : null;
  if(m?.wall && m.capturedAt === e.time)return m.wall.slice(0,10);
  if (e.time_precision === 'date' && e.provenance?.calendarDate && !e.provenance.reviewed) return e.provenance.calendarDate;
  const zone=e.timezone || 'America/Los_Angeles',key=zone+'|'+e.time;
  if(dayCache.has(key))return dayCache.get(key);
  try {
    if(!dayFormats.has(zone))dayFormats.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}));
    const day=dayFormats.get(zone).format(e.time);
    if(dayCache.size>20000)dayCache.clear();dayCache.set(key,day);return day;
  } catch { return new Date(e.time).toISOString().slice(0,10); }
}
export const eraFor = e => ERAS.filter(([date]) => date <= recordDay(e)).at(-1)?.[1] || 'Before Notes';
export const usable = e => !e.deletedAt && !e.analysisExcluded && !e.tags?.includes('_diagnostic');
export function ageAt(day) {
  const d = new Date(day+'T12:00Z'), b = new Date(BIRTHDAY+'T12:00Z');
  const days = Math.round((d-b)/86400000);
  if (days < 0) return 'Before birth';
  if (days < 112) return `${Math.floor(days/7)} weeks old`;
  const months = (d.getUTCFullYear()-2025)*12+d.getUTCMonth()-6-(d.getUTCDate()<25 ? 1 : 0);
  return months < 24 ? `${months} months old` : `${Math.floor(months/12)} years, ${months%12} months`;
}
export function selectedPhotos(events) {
  return events.filter(usable).flatMap(e => winniePhotos(e).map(p => {
    const m = p.metadata;
    const time = m?.capturedAt || e.time;
    return {event:e, photo:p, time, day:m?.wall?.slice(0,10) || recordDay(e),
      location: m?.location || placeName(e),
      position:m?.pin || e.placePin};
  })).sort((a,b) => b.time-a.time);
}
export function chapters(events) {
  const groups = new Map();
  for (const e of events.filter(usable)) {
    const day = recordDay(e), month = day.slice(0,7);
    if (!groups.has(month)) groups.set(month,{month,days:new Set(),events:[],photos:[]});
    const g = groups.get(month); g.days.add(day); g.events.push(e);
  }
  for (const p of selectedPhotos(events)) {
    const month=p.day.slice(0,7);
    if (!groups.has(month)) groups.set(month,{month,days:new Set(),events:[],photos:[]});
    groups.get(month).photos.push(p);
  }
  return [...groups.values()].sort((a,b)=>b.month.localeCompare(a.month));
}
export function toileting(e) {
  const text = `${e.provenance?.reviewed ? '' : e.provenance?.text || ''} ${e.note || ''} ${(e.tags || []).join(' ')}`;
  const indoor = /\bindoor(?:s)?\b/i.test(text), outdoor = /\boutdoor(?:s)?\b|\boutside\b/i.test(text);
  return {setting: indoor !== outdoor ? indoor ? 'indoor' : 'outdoor' : 'unknown',
    accident: /accident|⛔|🚨/i.test(text) && !/\?/.test(text) ? true : null};
}
export function trainingMonths(events) {
  return chapters(events).map(g => {
    const bathroom=g.events.filter(e => ['pee','poop'].includes(e.type));
    const indoor=bathroom.filter(e=>toileting(e).setting==='indoor').length;
    const outdoor=bathroom.filter(e=>toileting(e).setting==='outdoor').length;
    return {...g,total:bathroom.length,indoor,outdoor,known:indoor+outdoor,
      accidents:bathroom.filter(e=>toileting(e).accident).length,
      training:g.events.filter(e => e.type==='enrichment' && /train|Will|🏋|🚄|🚊/i.test(`${e.note} ${e.subkind} ${e.enrichment_kind}`))};
  }).filter(g=>g.total || g.training.length);
}
const median = values => { const a=[...values].sort((x,y)=>x-y); return a.length ? (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2 : null; };
export function comparePeriods(events, monthA, monthB, type='pee') {
  const period = month => {
    const rows=events.filter(e=>usable(e)&&recordDay(e).startsWith(month));
    const days=new Set(rows.filter(e=>['pee','poop','meal'].includes(e.type)).map(recordDay));
    const entries=rows.filter(e=>e.type===type && !e.provenance?.uncertainType);
    const counts=[...days].map(day=>entries.filter(e=>recordDay(e)===day).length);
    return {month, days:days.size, count:entries.length, median:median(counts), ids:entries.map(e=>e.id),
      eras:[...new Set(rows.map(eraFor))]};
  };
  const a=period(monthA),b=period(monthB);
  const comparable=monthA!==monthB && a.days>=14 && b.days>=14 && a.eras.length===1 && b.eras.length===1 && a.eras[0]===b.eras[0] && Math.abs(a.days-b.days)<=5;
  return {a,b,comparable,change:comparable ? b.median-a.median : null};
}
export function milestoneCandidates(events) {
  const sorted=events.filter(usable).sort((a,b)=>a.time-b.time);
  const patterns=[['Asked to go potty',/successful ask|winnie asked|alerted potty/i],['Lifted his leg',/leg up/i],['Puppy class',/puppy pre school|puppy agility|puppy training/i],['First recorded groomer visit',/groomer/i]];
  return patterns.map(([title,re])=>({title,event:sorted.find(e=>re.test(e.provenance?.text || e.note || ''))})).filter(x=>x.event && !x.event.milestone);
}
export function destinationCollections(events) {
  const groups=new Map();
  for (const e of events.filter(usable)) {
    const city=cityFor(e), name=city?.name || placeName(e);
    if (!name || ['indoors','outdoors','inside','outside','unknown'].includes(name.toLowerCase())) continue;
    const key=city ? `${city.id}` : name.toLowerCase();
    if (!groups.has(key)) groups.set(key,{key,name,events:[],days:new Set()});
    const g=groups.get(key);g.events.push(e);g.days.add(recordDay(e));
  }
  for (const p of selectedPhotos(events)) {
    const city=cityFor({placePin:p.position,location:p.location}), name=city?.name || p.location;
    if(!name)continue;
    const key=city ? String(city.id) : name.toLowerCase();
    if(!groups.has(key))groups.set(key,{key,name,events:[],days:new Set()});
    const g=groups.get(key);g.photos ||= [];g.photos.push(p);g.days.add(p.day);
    if(!g.events.some(e=>e.id===p.event.id))g.events.push(p.event);
  }
  return [...groups.values()].sort((a,b)=>b.days.size-a.days.size);
}
export function answerRecords(events, question) {
  const q=question.trim().toLowerCase();
  if (!q) return {text:'Ask about a recorded activity, place or note.',events:[]};
  const all=events.filter(usable).sort((a,b)=>a.time-b.time);
  const first=/\bfirst|earliest\b/.test(q), last=/\blast|latest\b/.test(q);
  let terms=q.replace(/\b(when|was|did|he|his|winnie|the|a|an|have|go|to|we|our|first|earliest|last|latest|show|me|photos|of|with|records|about)\b/g,' ').trim().split(/\s+/).filter(Boolean);
  const aliases={potty:'pee',pooped:'poop',peed:'pee',ate:'meal',food:'meal',groomer:'groom',training:'train'};
  terms=terms.map(t=>aliases[t] || t);
  if (!terms.length) return {text:'Try “first puppy class”, “last bath”, “Will” or a place name.',events:[]};
  let found=all.filter(e=>terms.every(t=>`${e.type} ${e.careTitle || ''} ${e.note || ''} ${e.provenance?.text || ''} ${placeName(e)} ${(e.tags||[]).join(' ')}`.toLowerCase().includes(t)));
  const count=found.length;
  if (last) found=found.slice(-1); else if(first) found=found.slice(0,1); else found=found.reverse();
  return {text:!count ? 'No matching record. That does not mean it never happened.' : first ? 'Earliest matching record. This may not be the first time it happened.' : last ? 'Latest matching record.' : `${count} matching records.`,events:found};
}
