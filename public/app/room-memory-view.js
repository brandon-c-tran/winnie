import { graduationMemory } from '../room-memory.js?v=4.28';
import { ageAt, recordDay, selectedPhotos } from '../lifetime.js?v=4.28';
import { facts, sync } from './services.js?v=4.28';
import { $, esc } from './format.js?v=4.28';
import { openDialog } from './ui.js?v=4.28';
import { detail, hydratePhotos } from './entries.js?v=4.28';
import { recollectionsHTML, remember } from './recollections.js?v=4.28';
import { pickMemoryPhoto } from './photo-picker.js?v=4.28';
import { addPhotos } from './photos.js?v=4.28';

export function openGraduation() {
  const memory = graduationMemory(facts(), sync.view().profile);
  if (!memory) {
    openDialog(`<h2 id="dialog-title">Canine Good Citizen</h2><p>${sync.view().profile.cgcMemory ? 'The linked photo is no longer available.' : 'A place for his graduation photo and your memories of that day.'}</p><div class="button-row"><button class="primary" id="cgc-choose">Choose graduation photo</button><button class="secondary" id="cgc-add">Add photos</button></div><p id="form-error" class="error" role="alert"></p>`);
    $('cgc-choose').onclick = chooseGraduation;
    $('cgc-add').onclick = () => addPhotos();
    return;
  }
  const { event, photo } = memory;
  const day = photo.metadata?.wall?.slice(0, 10) || recordDay(event);
  const date = new Date(day + 'T12:00Z').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', timeZone:'UTC' });
  openDialog(`<article class="graduation-memory"><h2 id="dialog-title">Canine Good Citizen</h2><figure><img class="graduation-photo" data-photo="${esc(photo.id)}" alt="Winnie with his Canine Good Citizen ribbon"><figcaption><time datetime="${day}">${date}</time><span>${esc(ageAt(day))}</span></figcaption></figure>${event.note && event.note.trim().toLowerCase() !== 'canine good citizen' ? `<p class="detail-notes">${esc(event.note)}</p>` : ''}${recollectionsHTML(event)}<div class="button-row"><button class="primary" id="cgc-remember">${event.recollections?.[sync.session.person]?.text ? 'Edit my recollection' : 'Add a recollection'}</button><button class="text-button" id="cgc-source">View original entry</button></div><button class="text-button cgc-change" id="cgc-choose">Change graduation photo</button><p id="form-error" class="error" role="alert"></p></article>`);
  $('cgc-remember').onclick = () => remember(event.id, photo.id, openGraduation);
  $('cgc-source').onclick = () => detail(event.id);
  $('cgc-choose').onclick = chooseGraduation;
  hydratePhotos();
}

function chooseGraduation() {
  pickMemoryPhoto({
    title: 'Choose graduation photo',
    photos: selectedPhotos(facts()),
    onChoose: async p => {
      await sync.enqueue('profile', null, { cgcMemory: { eventId:p.event.id, photoId:p.photo.id } });
      openGraduation();
    },
  });
}
