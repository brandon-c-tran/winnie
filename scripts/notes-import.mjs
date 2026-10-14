// Pure staging transform. Source files are private inputs, never bundled with the app.
import { createHash } from 'node:crypto';
import { wallInstants } from '../public/photo-metadata.js';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,24);
const nextDay = day => new Date(Date.parse(day+'T12:00Z')+86400000).toISOString().slice(0,10);
export function sourceZone(day) {
  if(day>='2026-01-30' && day<='2026-02-02')return null;
  return day>='2025-12-23' && day<='2026-01-05' ? 'America/Chicago' : 'America/Los_Angeles';
}
function clockToken(value) {
  const match=value?.trim().match(/^(\d{1,2})(?:[:;.](\d{2}))?\s*(am|pm)?/i);
  if(!match || +match[1]>12 || +match[1]<1 || +(match[2]||0)>59)return null;
  return {minute:(+match[1]%12)*60+(+match[2]||0),half:match[3]?.toLowerCase()};
}
export function stageNotes(ledger, {includeMarch=false} = {}) {
  const events=[],held=[],duplicates=[];
  const days=new Map();
  for(const row of ledger.rows) {
    if(row.file==='march-2026.txt' && !includeMarch)continue; // Reconcile existing IDs separately.
    if(row.context!=='dated' || !row.proposedDate){held.push(row);continue;}
    if(!days.has(row.proposedDate))days.set(row.proposedDate,[]);
    days.get(row.proposedDate).push(row);
  }
  for(const [day,rows] of days) {
    let high=0,overnight=false,openNap=null;
    const seen=new Set();
    for(const row of rows) {
      const text=row.text || '', flags=[...(row.flags||[])];
      const rawTime=(row.timeText || '').replace(/\s*\([^)]*\)/g,'').trim();
      const range=rawTime.split(/\s*[-–]\s*/), token=clockToken(range[0]);
      let minute=null,calendarDate=day;
      if(token) {
        if(token.half) minute=token.minute+(token.half==='pm'?720:0);
        else {
          const options=[token.minute,token.minute+720];
          minute=options.find(n=>n>=high-90) ?? options[1];
          if(/breakfast|wake up/i.test(text) && high<600)minute=token.minute;
          if(/dinner|slumber/i.test(text))minute=token.minute+720;
          if(high>=1140 && token.minute<360) {overnight=true;minute=token.minute;}
          if(overnight && token.minute<480)minute=token.minute;
        }
        if (high>=1140 && minute<360) overnight=true;
        if(overnight && minute<480)calendarDate=nextDay(day);
        else high=Math.max(high,minute);
      }
      const zone=sourceZone(day);
      if(!zone)flags.push('Trip time zone not established');
      if(!token)flags.push('Time missing or invalid');
      if(/ish|\?/.test(rawTime))flags.push('Approximate time');
      if(!text.trim())flags.push('Activity missing');
      if(/\?/.test(text))flags.push('Uncertain observation');
      if(day==='2026-02-17' && /nap|💤/i.test(text))flags.push('Overlapping source sleep sequence');
      if(day==='2026-02-15' && rawTime==='10:06')flags.push('Possible duplicate at 10:06');
      const wall=minute==null ? '' : `${calendarDate}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
      const instant=wall && zone ? wallInstants(wall,zone)[0] : null;
      const time=instant || wallInstants(calendarDate+'T12:00','America/Los_Angeles')[0];
      let end=null;
      if(range[1] && token && instant) {
        let endToken=clockToken(range[1]);
        if(/^\d{2}$/.test(range[1]) && +range[1]<60 && +range[1]>12)endToken={minute:Math.floor(minute%720/60)*60+(+range[1])};
        if(endToken) {
          const options=[endToken.minute,endToken.minute+720,endToken.minute+1440];
          const stop=options.find(n=>n>minute);
          if(stop!=null) {
            const endDay=stop>=1440 ? nextDay(calendarDate) : calendarDate, n=stop%1440;
            end=wallInstants(`${endDay}T${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,zone)[0] || null;
          }
        }
      }
      const pee=/🟨|\bpotty|potties|\bpee(?:d|s)?\b/i.test(text), poop=/💩|\bpoop(?:ed|s)?\b/i.test(text);
      const uncertain=/\?|multiple|had peed|had pooped|had some|had.*poop|sit until|poop training|no potty/i.test(text) || !text.trim();
      let types=[];
      if(!uncertain) {if(pee)types.push('pee');if(poop)types.push('poop');}
      if(/breakfast|breakdast|breakfas\b|dinner|🍔/i.test(text))types.push('meal');
      const sleep=/nap|slumber|sleep|💤/i.test(text) && !/total|nap ends|wake|napperoni.*attempt/i.test(text);
      if(sleep)types.push(minute>=1140 && !end ? 'slumber' : 'nap');
      if(/vet|appointment/i.test(text))types.push('appointment');
      if(/bath|shower|groomer/i.test(text))types.push('grooming');
      if(/traz[ao]done|\bCBD\b/i.test(text))types.push('medication');
      if(/train|🏋|🚄|🚊|\bWill\b|puppy pre school|puppy agility|kong|groov|snuffle|lick mat|playtime|playgroup|chew|bully stick/i.test(text))types.push('enrichment');
      if(/walk|🦮|🚶/i.test(text))types.push('walk');
      if(/throw up|vomit/i.test(text))types.push('vomit');
      if(!types.length)types=['note'];
      if(uncertain && (pee||poop)) {types=['note'];flags.push('Bathroom occurrence or count uncertain');}
      const dayInfo=ledger.days.find(d=>d.file===row.file && d.proposedDate===day);
      const provenance={batch:'notes-2026-10-13-v1',sourceId:row.sourceId,file:row.file,line:row.line,raw:row.raw,text,header:row.header,
        sourceDate:day,calendarDate,wall,timezone:zone,flags,
        basis:token && !token.half ? 'AM/PM inferred from source sequence and explicit meal labels' : 'As written',
        ...(dayInfo?.dateStatus?.includes('proposed') || dayInfo?.declaredDate!==day ? {dateCorrection:dayInfo?.declaredDate+' → '+day} : {})};
      for(const type of [...new Set(types)]) {
        const duplicateKey=`${calendarDate}|${minute ?? rawTime}|${text}|${type}`;
        if(seen.has(duplicateKey)){
          if(day==='2026-03-15' && type==='slumber'){duplicates.push(row);continue;}
          flags.push('Possible repeated source entry');
        }
        seen.add(duplicateKey);
        const isSleep=['nap','slumber'].includes(type);
        const event={id:'notes_'+hash(row.sourceId+'|'+type),type,time,end_time:isSleep || type==='walk' || type==='enrichment' ? end : null,
          time_precision:!instant || /ish|\?/.test(rawTime) ? 'date' : range[1] && ['pee','poop'].includes(type) ? 'interval' : 'minute',
          timezone:zone || '',historical:true,retroactive:true,source:'notes',who:/\bWill\b/i.test(text)?'trainer':'unknown',
          note:text,tags:[...(flags.length?['needs-review']:[]),...(['pee','poop'].includes(type) && /accident|⛔|🚨/i.test(text)?['accident']:[])],provenance:{...provenance},
          ...(type==='grooming'?{careTitle:/groomer/i.test(text)?'Groomer visit':'Bath'}:{}),
          ...(type==='enrichment' && /train|🏋|🚄|🚊|\bWill\b|puppy pre school|puppy agility/i.test(text)?{enrichment_kind:'training'}:{})};
        if(type==='note' && /total|^\d.*hr/i.test(text))event.provenance.summary=true;
        if(isSleep && !end)event.provenance.openEnd=true;
        events.push(event);
        if(type==='nap' && /begins/i.test(text))openNap=event;
      }
      if(openNap && /nap ends/i.test(text) && instant && instant>openNap.time) {
        openNap.end_time=instant;openNap.provenance.endSource=row.raw;delete openNap.provenance.openEnd;openNap=null;
      }
    }
  }
  // Open night intervals close only on an explicit wake on the adjacent calendar day.
  for(const e of events.filter(e=>e.type==='slumber' && e.end_time==null && e.time_precision==='minute')) {
    const next=nextDay(e.provenance.calendarDate);
    const wake=events.find(x=>x.type==='note' && x.provenance.sourceDate===next && /wake(?: up)?$/i.test(x.note) && x.time_precision==='minute' && x.time>e.time);
    if(wake && wake.time-e.time<18*3600000) {e.end_time=wake.time;e.provenance.endSource=wake.provenance.raw;e.provenance.sleepWindow=true;delete e.provenance.openEnd;}
  }
  return {version:1,events,held,duplicates,manifest:ledger.manifest};
}
