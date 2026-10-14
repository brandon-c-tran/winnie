import { BIRTHDAY, HOMECOMING, ERAS, recordDay, ageAt, chapters, selectedPhotos, trainingMonths, comparePeriods, milestoneCandidates, destinationCollections, answerRecords } from '../lifetime.js?v=4.21';
import { facts, sync } from './services.js?v=4.21';
import { $, esc, uid } from './format.js?v=4.21';
import { html, openDialog, closeDialog, safe, toast } from './ui.js?v=4.21';
import { entry, hydratePhotos } from './entries.js?v=4.21';
import { openHistory } from './nav.js?v=4.21';
import { wallInstants } from '../photo-metadata.js?v=4.21';
let month = '', question = '', answerLimit = 20;
const monthName = value => new Date(value+'-15T12:00Z').toLocaleDateString([], {month:'long',year:'numeric',timeZone:'UTC'});
const photosHTML = photos => `<div class="chapter-photos">${photos.map(p => `<button data-open="${esc(p.event.id)}" aria-label="Photo from ${esc(p.day)}"><img data-photo="${esc(p.photo.id)}" alt="${esc(p.event.note || 'Winnie')}" loading="lazy"></button>`).join('')}</div>`;
const dates = rows => [...new Set(rows.map(recordDay))].sort();
function sourceRows(rows) { return rows.map(e=>entry(e)).join(''); }
export function renderLifetime() {
  const events=facts(), groups=chapters(events);
  if (!groups.some(g=>g.month===month)) month=groups[0]?.month || '';
  const g=groups.find(g=>g.month===month);
  const marked=events.filter(e=>e.milestone).sort((a,b)=>a.time-b.time);
  const candidates=milestoneCandidates(events);
  const held=(sync.view().profile?.historyArchive?.held || []).filter(r=>r.context!=='title');
  const review=events.filter(e=>e.provenance?.flags?.length && !e.provenance.reviewed);
  $('load-more').hidden=true;
  html('story-items', `<div class="lifetime-view">
    <div class="life-origin"><p><strong>Born</strong><span>July 25, 2025</span></p><p><strong>Came home</strong><span>October 4, 2025</span></p></div>
    <form id="record-question" class="record-question"><label for="record-question-input">Find something in his history</label><div><input id="record-question-input" type="search" value="${esc(question)}" placeholder="First puppy class, last bath, Will…" required><button class="px btn ink">Find</button></div></form><div id="record-answer" aria-live="polite"></div>
    <section class="life-chapter"><div class="card-head"><h2>By age</h2><label><span class="sr-only">Month</span><select id="life-month">${groups.map(x=>`<option value="${x.month}" ${x.month===month?'selected':''}>${monthName(x.month)}</option>`).join('')}</select></label></div>
    ${g ? `<p class="chapter-age">${esc(ageAt(month+'-15'))} at mid-month</p><p class="fine">${g.days.size} days with records. Missing days stay blank.</p>${photosHTML(g.photos.slice(0,12))}<div class="month-days" aria-label="Days with records in ${monthName(month)}">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<span class="fine" aria-hidden="true">${d}</span>`).join('')}${Array.from({length:new Date(month+'-01T12:00').getDay()},()=>'<span aria-hidden="true"></span>').join('')}${Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()},(_,i)=>{const day=month+'-'+String(i+1).padStart(2,'0');return `<button ${g.days.has(day)?`data-life-day="${day}"`:'disabled'} aria-label="${day}${g.days.has(day)?', view entries':', no records'}">${i+1}</button>`;}).join('')}</div><button class="text-button" data-life-month="${month}">Read ${monthName(month)}</button>` : '<p>No history yet. Saved entries and photos will appear here.</p>'}</section>
    <section class="life-milestones"><div class="card-head"><h2>Milestones</h2><button class="text-button" data-new-milestone>Add milestone</button></div>${marked.length ? marked.map(e=>`<button class="life-line" data-open="${esc(e.id)}"><strong>${esc(e.milestone)}</strong><span>${recordDay(e)}</span><small>${ageAt(recordDay(e))}</small></button>`).join('') : '<p class="fine">Keep a date you want to remember.</p>'}
    ${candidates.length?`<details><summary>First recorded moments</summary><p class="fine">These are the earliest matching notes, not confirmed firsts. Keep the ones that matter.</p>${candidates.map(({title,event:e})=>`<div class="candidate-row"><button class="text-button" data-open="${esc(e.id)}">${esc(title)}<small>${recordDay(e)}</small></button><button class="px btn" data-mark-milestone="${esc(e.id)}" data-title="${esc(title)}">Keep</button></div>`).join('')}</details>`:''}</section>
    <details class="life-sources"><summary>How the records changed</summary><p>Logging began in Notes. Fields came and went as routines changed.</p>${ERAS.map(([day,title,note])=>`<div class="era-row"><time>${day}</time><div><strong>${title}</strong><p>${note}</p></div></div>`).join('')}<p class="fine">Earliest available note: October 6, 2025. October 4–5 and most of November are still missing.</p></details>
    ${review.length ? `<details class="life-sources"><summary>${review.length} entries with source questions</summary><p class="fine">Original wording is kept with each entry. Uncertain clocks and types are excluded from precise comparisons.</p>${sourceRows(review.slice(0,20))}${review.length>20?'<p class="fine">Search “needs-review” in the daily log to see all.</p>':''}</details>`:''}
    ${held.length ? `<details class="life-sources"><summary>Undated notes & schedule drafts</summary><p class="fine">Kept from the original Notes. These do not count as completed activities.</p>${held.map(row=>`<div class="era-row"><span class="fine">${esc(row.file)}<br>Line ${row.line}</span><pre class="source-note">${esc(row.raw)}</pre></div>`).join('')}</details>` : ''}
    </div>`);
  $('life-month').onchange=event=>{month=event.target.value;renderLifetime();$('life-month').focus();};
  $('record-question').onsubmit=event=>{event.preventDefault();question=$('record-question-input').value;answerLimit=20;renderAnswer();};
  if(question)renderAnswer();
  hydratePhotos();
}
function renderAnswer() {
  const answer=answerRecords(facts(),question);
  html('record-answer', `<p>${esc(answer.text)}</p>${sourceRows(answer.events.slice(0,answerLimit))}${answer.events.length>answerLimit?'<button class="text-button" data-answer-more>Show more matches</button>':''}`);
  hydratePhotos();
}
export function changesHTML(events) {
  const months=chapters(events).filter(g=>g.events.length).map(g=>g.month);
  const options=months.map(m=>`<option value="${m}">${monthName(m)}</option>`).join('');
  return `<section class="life-changes"><h2>What changed?</h2><div class="comparison-controls"><label>Earlier month<select id="compare-a">${options}</select></label><label>Later month<select id="compare-b">${options}</select></label><label>Activity<select id="compare-type"><option value="pee">Pee</option><option value="poop">Poop</option><option value="meal">Meals</option></select></label></div><div id="compare-result" aria-live="polite"></div><details><summary>Indoor to outdoor training</summary><p class="fine">Indoor use and accidents are separate. Unlabeled entries are unknown, not outdoor successes.</p><div class="training-months">${trainingMonths(events).filter(g=>g.known || g.accidents).reverse().map(g=>`<article class="training-month"><button class="text-button" data-life-month="${g.month}">${monthName(g.month)}</button><div><strong>${g.known ? g.outdoor+' of '+g.known : 'Place unknown'}</strong><span>${g.known ? 'labeled entries were outdoors' : 'No indoor/outdoor labels'}</span></div>${g.known ? `<div class="setting-bar" role="img" aria-label="${g.outdoor} outdoor, ${g.indoor} indoor"><span style="width:${g.outdoor/g.known*100}%"></span></div>` : ''}<p class="fine">Place labeled on ${g.known} of ${g.total} bathroom records.</p><p class="fine">${g.accidents} accidents explicitly noted</p></article>`).join('')}</div><p class="fine">Accident counts are recorded observations, not a success rate. Place annotations drop sharply in early 2026.</p></details><details><summary>Training with Will and at home</summary>${trainingMonths(events).filter(g=>g.training.length).map(g=>`<div class="candidate-row"><button class="text-button" data-training-month="${g.month}">${monthName(g.month)}</button><span>${g.training.length} recorded sessions</span></div>`).join('') || '<p class="fine">No named training sessions yet.</p>'}<p class="fine">Sessions are counted from training annotations. This does not establish what caused a behavior change.</p></details></section>`;
}
export function bindChanges() {
  const a=$('compare-a'),b=$('compare-b');
  if(!a || !b)return;
  a.selectedIndex=Math.min(1,a.options.length-1);
  const update=()=>{
    if(!a.value || !b.value)return;
    const result=comparePeriods(facts(),a.value,b.value,$('compare-type').value);
    html('compare-result', `<div class="comparison-values">${[result.a,result.b].map(p=>`<div><span>${monthName(p.month)}</span><strong>${p.median ?? '—'}</strong><span>median records per logged day</span><small>${p.count} entries across ${p.days} days</small></div>`).join('')}</div><p>${result.comparable?`${result.change===0?'No change in the median':Math.abs(result.change)+' '+(result.change>0?'more':'fewer')+' records per logged day'}. Both months use the same logging era.`:'Descriptive totals only: the logging eras or coverage differ, or fewer than 14 days were recorded.'}</p><p class="fine">These are logging patterns. They do not measure unrecorded activity or establish a medical change.</p><div class="button-row"><button class="text-button" data-life-month="${a.value}">Earlier entries</button><button class="text-button" data-life-month="${b.value}">Later entries</button></div>`);
  };
  for(const el of [a,b,$('compare-type')])el.onchange=update;
  update();
}
export function collectionsHTML() {
  const events=facts(), trips=events.filter(e=>e.tags?.includes('trip-collection'));
  const destinations=destinationCollections(events);
  return `<section class="memory-collections"><div class="card-head"><h2>Trips & places</h2><button class="text-button" data-new-trip>Add trip</button></div>${trips.map(e=>`<button class="life-line" data-trip="${esc(e.id)}"><strong>${esc(e.note)}</strong><span>${recordDay(e)} — ${recordDay({...e,time:e.end_time || e.time})}</span></button>`).join('')}${destinations.slice(0,8).map(g=>`<button class="life-line" data-destination="${esc(g.key)}"><strong>${esc(g.name)}</strong><span>${g.days.size} recorded days</span></button>`).join('') || (!trips.length?'<p class="fine">Photos with location data and saved places collect here.</p>':'')}<p class="fine">Trip dates are chosen by you. Place groups collect recorded days, not inferred visits.</p></section>`;
}
function collectionDialog(title,rows,photos=selectedPhotos(rows)) {
  const days=[...new Set([...dates(rows),...photos.map(p=>p.day)])].sort();
  openDialog(`<h2 id="dialog-title">${esc(title)}</h2><p class="fine">${days.length} recorded days${days.length?' from '+days[0]+' to '+days.at(-1):''}</p>${photosHTML(photos)}<details><summary>${rows.length} entries</summary>${sourceRows(rows.slice(0,80))}${rows.length>80?'<p class="fine">Use Story’s timeline for the complete date range.</p>':''}</details>`);
  hydratePhotos();
}
document.addEventListener('click',safe(async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.lifeDay)openHistory({from:b.dataset.lifeDay,to:b.dataset.lifeDay});
  if(b.dataset.lifeMonth){const m=b.dataset.lifeMonth;openHistory({from:m+'-01',to:m+'-'+new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate()});}
  if(b.hasAttribute('data-answer-more')){answerLimit+=40;renderAnswer();}
  if(b.dataset.trainingMonth){const g=trainingMonths(facts()).find(x=>x.month===b.dataset.trainingMonth);collectionDialog('Training in '+monthName(g.month),g.training);}
  if(b.dataset.markMilestone){await sync.enqueue('edit',b.dataset.markMilestone,{milestone:b.dataset.title});renderLifetime();toast('Milestone kept');}
  if(b.dataset.destination){const g=destinationCollections(facts()).find(x=>x.key===b.dataset.destination);if(g)collectionDialog(g.name,g.events,g.photos || []);}
  if(b.dataset.trip){const trip=facts().find(e=>e.id===b.dataset.trip);if(trip){const start=recordDay(trip),end=recordDay({...trip,time:trip.end_time});collectionDialog(trip.note,facts().filter(e=>e.id!==trip.id && recordDay(e)>=start && recordDay(e)<=end),selectedPhotos(facts()).filter(p=>p.day>=start && p.day<=end));}}
  if(b.hasAttribute('data-new-trip')||b.hasAttribute('data-new-milestone')){
    const trip=b.hasAttribute('data-new-trip');
    openDialog(`<h2 id="dialog-title">${trip?'Add trip':'Add milestone'}</h2><form id="life-form"><label>Name<input name="title" maxlength="120" required placeholder="${trip?'Texas with Winnie':'A moment to remember'}"></label><label>${trip?'First day':'Date'}<input name="start" type="date" min="${BIRTHDAY}" required></label>${trip?'<label>Last day<input name="end" type="date" required></label>':''}<p class="fine">${trip?'Includes entries and selected photos in this date range.':'Saved with the date you choose.'}</p><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`);
    $('life-form').onsubmit=safe(async ev=>{ev.preventDefault();const form=new FormData(ev.target),start=String(form.get('start')),end=trip?String(form.get('end')):start;
      if(end<start)throw Error('Choose a last day after the first day.');
      const zone='America/Los_Angeles',time=wallInstants(start+'T00:00',zone)[0],endTime=wallInstants(end+'T23:59',zone)[0];
      if(!time || time>Date.now() || !endTime)throw Error('Choose a date up to today.');
      await sync.enqueue('create',uid(),{type:'moment',time,time_precision:'date',timezone:zone,note:String(form.get('title')).trim(),tags:trip?['trip-collection']:[],...(trip?{end_time:Math.min(endTime,Date.now())}:{milestone:String(form.get('title')).trim()}),retroactive:true,who:'us'});
      closeDialog();toast(trip?'Trip saved':'Milestone saved');
    });
  }
}));
// Facts confirmed by the family, independent of the first available log.
export const lifeDates = {birthday:BIRTHDAY,homecoming:HOMECOMING};

document.addEventListener('travel-save-trip',event=>{
  // Reuse the existing reviewed trip form; no inferred outing becomes a record silently.
  const trigger=document.createElement('button');trigger.dataset.newTrip='';document.body.append(trigger);trigger.click();trigger.remove();
  const form=$('life-form');if(!form)return;
  form.elements.title.value=event.detail.name;form.elements.start.value=event.detail.start;form.elements.end.value=event.detail.end;
});
