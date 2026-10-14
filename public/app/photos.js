import { readPhotoMetadata, wallInstants, wallTime } from '../photo-metadata.js?v=4.26';
import { cityFor, cityLabel, loadCities } from '../places.js?v=4.26';
// Photo picking, resizing, and saving.
import { $, clock, dateLabel, esc, uid } from "./format.js?v=4.26";
import {
  closeDialog,
  openDialog,
  safe,
  toast,
  retainDialogDraft,
  resumeDialogDraft,
  markDialogDirty,
  draftFields,
  applyDraftFields,
  persistDialogDraft,
} from "./ui.js?v=4.26";
import { isCarePhoto } from "../keepsakes.js?v=4.26";
import { facts, sync, photoURLs } from "./services.js?v=4.26";
import { detail, eventLabel, hydratePhotos } from "./entries.js?v=4.26";
import { icon } from "../icons.js?v=4.0";
import { render } from "./today.js?v=4.26";
import { state } from "./state.js?v=4.26";

// The photo composer owns its previews; they never enter the shared log before Save.
let draft = null;
function clearDraft() {
  draft?.items.forEach((item) => URL.revokeObjectURL(item.url));
  draft = null;
}

export function addPhotos(care = false, restored = null) {
  if (!care && !restored && resumeDialogDraft("photos:" + sync.session?.home))
    return;
  if (care) {
    openDialog(
      `<h2 id="dialog-title">Attach to care entry</h2><label class="search-box"><span class="sr-only">Find care entry</span><input id="attach-search" type="search" placeholder="Search date, note or type"></label><div id="attach-entries" class="attach-entries"></div><button class="text-button" data-act="earlier">Add a care entry</button><p id="form-error" class="error" role="alert"></p>`,
    );
    const show = () => {
      const query = $("attach-search").value.trim().toLowerCase();
      const entries = facts().filter(
        (e) =>
          isCarePhoto(e) &&
          `${eventLabel(e)} ${dateLabel(e.time)} ${e.note || ""}`
            .toLowerCase()
            .includes(query),
      );
      $("attach-entries").innerHTML =
        entries
          .slice(0, 40)
          .map(
            (e) =>
              `<button class="attach-entry" data-attach-entry="${esc(e.id)}"><span><strong>${esc(eventLabel(e))}</strong><small>${dateLabel(e.time)}</small>${e.note ? `<span>${esc(e.note)}</span>` : ""}</span><span class="entry-time">${clock(e.time)}</span></button>`,
          )
          .join("") || '<p class="fine">No matching care entries.</p>';
    };
    $("attach-search").oninput = show;
    show();
    return;
  }
  openDialog(
    `<h2 id="dialog-title">Add photos</h2><form id="photo-composer"><div class="photo-composer-pick"><button type="button" class="primary" data-album-library>${icon("photo", "ic sm")} Choose photos</button><button type="button" class="secondary" data-album-camera>Take photo</button></div><div id="photo-draft" class="photo-draft"></div><p id="photo-draft-status" class="fine" role="status">No photos selected</p><label>Caption <span class="fine">(optional)</span><textarea name="note" maxlength="10000" placeholder="Add a caption"></textarea></label><p class="fine">Add up to 100 photos at a time. Each keeps its own date and place; photos already in Winnie are skipped.</p><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary" type="submit" disabled>Save photos</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  draft = {
    id: restored?.id || uid(),
    items: (restored?.items || []).map((item) => ({
      ...item,
      id: item.id || (restored?.saved ? restored.id : uid()),
      photoId: item.photoId || uid(),
      metadata: item.metadata || {wall: restored?.fields?.time || "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, origin: "manual"},
      url: URL.createObjectURL(item.blob),
    })),
    saved: restored?.saved || false,
    busy: false,
  };
  const current = draft;
  const composer = $("photo-composer");
  applyDraftFields(composer, restored?.fields);
  retainDialogDraft(
    "photos:" + sync.session?.home,
    () => {
      draft = current;
      renderDraft();
    },
    () => {
      current.items.forEach((item) => URL.revokeObjectURL(item.url));
      current.items = [];
      if (draft === current) draft = null;
    },
    () => ({
      kind: "photos",
      id: current.id,
      saved: current.saved,
      items: current.items.map(({url: _url, ...item}) => item),
      fields: draftFields(composer),
    }),
  );
  composer.elements.note.disabled = current.saved;

  renderDraft();
  $("photo-composer").onsubmit = safe(async (event) => {
    event.preventDefault();
    if (current.busy || current.preparing || !current.items.length) return;
    current.busy = true;
    const form = event.target;
    const data = new FormData(form);
    form
      .querySelectorAll("button, input, textarea")
      .forEach((el) => (el.disabled = true));
    try {
      // Validate the whole batch before creating any records.
      for (const item of current.items) {
        const m = item.metadata;
        let candidates = m.capturedAt && wallTime(m.capturedAt, m.timezone || 'UTC') === m.wall ? [m.capturedAt] : [];
        if (m.offset && !m.timezone) candidates = [Date.parse(m.wall + ':00' + m.offset)];
        else if (!(m.origin === 'exif-offset' && m.capturedAt && wallTime(m.capturedAt,m.timezone) === m.wall)) candidates = wallInstants(m.wall, m.timezone);
        if (candidates.length !== 1 || !Number.isFinite(candidates[0]) || candidates[0] > Date.now()+60000)
          throw Error('Check each photo’s date and time zone. A repeated daylight-saving hour needs the camera offset.');
        // An explicit camera offset resolves a repeated hour if it still matches.
        m.capturedAt = candidates[0];
      }
      await persistDialogDraft();
      while (current.items.length) {
        const item = current.items[0], m = item.metadata;
        if (!sync.view().events.some(e => e.id === item.id)) {
          await sync.enqueue('create', item.id, {
            type: 'moment', time: m.capturedAt, note: String(data.get('note')).trim(),
            who: 'us', tags: [], timezone: m.timezone || 'UTC', retroactive: true,
            location: m.location || '',
            ...(m.pin ? {placePin: {...m.pin, accuracy: 0, capturedAt: m.capturedAt}} : {}),
          });
        }
        await sync.addPhoto(item.id, item.blob, m, item.photoId);
        current.items.shift();
        URL.revokeObjectURL(item.url);
        await persistDialogDraft();
      }
      closeDialog();
      clearDraft();
      render();
      toast("Photos saved");
    } finally {
      current.busy = false;
      if (form.isConnected) {
        form
          .querySelectorAll("button, input, textarea")
          .forEach((el) => (el.disabled = false));
        // A retry finishes attachments to the same saved entry.
        form.elements.note.disabled = current.saved;

        renderDraft();
      }
    }
  });
}
document.addEventListener("winnie:resume-draft", ({ detail: data }) => {
  if (data?.kind === "photos") addPhotos(false, data);
});
function renderDraft() {
  if (!draft || !$("photo-draft")) return;
  const zones = Intl.supportedValuesOf?.('timeZone') || ['America/Los_Angeles','America/Chicago','America/New_York','UTC'];
  $('photo-draft').innerHTML = draft.items.map((item, index) => {
    const m = item.metadata;
    const options = [...new Set([m.timezone, ...zones].filter(Boolean))];
    return `<figure class="photo-import-row"><img src="${item.url}" alt="Selected photo ${index+1}"><figcaption><div class="photo-import-summary"><strong>${m.wall ? esc(new Date(m.wall).toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})) : "Date needed"}</strong><span>${esc(m.location || (m.pin ? "Photo location saved" : "No location in this photo"))}</span></div><details ${!m.capturedAt ? "open" : ""}><summary>Date & place</summary>
      <label>Date taken<input data-photo-field="wall" data-index="${index}" type="datetime-local" value="${esc(m.wall)}" required></label>
      <label>Time zone<select data-photo-field="timezone" data-index="${index}" ${m.offset && !m.timezone ? '' : 'required'}><option value="">${m.offset ? 'Camera offset '+esc(m.offset) : 'Choose time zone'}</option>${options.map(zone => `<option value="${esc(zone)}" ${zone === m.timezone ? 'selected' : ''}>${esc(zone.replaceAll('_',' '))}</option>`).join('')}</select></label>
      <label>Place <span class="fine">(optional)</span><input data-photo-field="location" data-index="${index}" value="${esc(m.location || '')}" maxlength="200" placeholder="Name a place"></label>
      <p class="fine">${m.origin === 'missing' ? 'No capture date in this file. Add the date you took it.' : m.origin === 'exif-gps-zone' ? 'Camera date. Time zone estimated from photo location.' : m.origin === 'exif-offset' ? 'Date and offset from camera.' : m.origin === 'camera' ? 'Taken now.' : 'Check date and time zone.'}</p>
      ${m.pin ? `<button type="button" class="text-button" data-remove-photo-pin="${index}">Remove photo location</button>` : '<p class="fine">No GPS location saved.</p>'}
      </details><button type="button" class="text-button" data-remove-draft="${index}" aria-label="Remove selected photo ${index+1}">Remove photo</button></figcaption></figure>`;
  }).join('');
  $("photo-draft-status").textContent =
    `${draft.items.length} ${draft.items.length === 1 ? "photo" : "photos"} selected`;
  $("photo-composer").querySelector('[type="submit"]').disabled =
    !draft.items.length || draft.busy || draft.preparing;
  $("photo-composer")
    .querySelectorAll(
      "[data-album-library], [data-album-camera], [data-remove-draft]",
    )
    .forEach((button) => (button.disabled = draft.busy || draft.preparing));
}
document.addEventListener('input', event => {
  const input = event.target.closest('[data-photo-field]');
  if (!input || !draft || draft.busy) return;
  const item = draft.items[Number(input.dataset.index)];
  item.metadata[input.dataset.photoField] = input.value;
  if (input.dataset.photoField !== 'location') { item.metadata.capturedAt = null; item.metadata.origin = 'manual'; }
  markDialogDirty();
});
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-remove-photo-pin") && draft && !draft.busy) {
    const m = draft.items[Number(b.dataset.removePhotoPin)].metadata;
    m.pin = null; m.location = ""; markDialogDirty(); renderDraft();
  }
  if (b.hasAttribute("data-album-library")) choosePhoto("album");
  if (b.hasAttribute("data-album-camera")) choosePhoto("album", true);
  if (b.hasAttribute("data-remove-draft") && draft && !draft.busy) {
    const [item] = draft.items.splice(Number(b.dataset.removeDraft), 1);
    if (item) URL.revokeObjectURL(item.url);
    markDialogDirty();
    renderDraft();
  }
  if (b.dataset.attachEntry) {
    detail(b.dataset.attachEntry);
    choosePhoto(b.dataset.attachEntry);
  }
});

document.addEventListener('click', safe(async event => {
  const b=event.target.closest('button');
  if(b?.dataset.reviewNote) {
    const e=facts().find(e=>e.id===b.dataset.reviewNote);
    if(!e)return;
    await sync.enqueue('edit',e.id,{provenance:{...e.provenance,reviewed:true},tags:(e.tags||[]).filter(t=>t!=='needs-review')});
    detail(e.id);toast('Source question marked reviewed');
  }
  if(!b?.dataset.editPhotoMeta)return;
  const e=facts().find(e=>e.id===b.dataset.id), p=e?.photos?.find(p=>p.id===b.dataset.editPhotoMeta);
  if(!p)return;
  const m={...(p.metadata || {})};
  const zone=m.timezone || e.timezone || 'America/Los_Angeles';
  openDialog(`<h2 id="dialog-title">Photo date & place</h2><form id="photo-metadata-form"><label>Date taken<input name="wall" type="datetime-local" value="${esc(m.wall || wallTime(e.time,zone))}" required></label><label>Time zone<input name="zone" value="${esc(zone)}" required placeholder="America/Los_Angeles"></label><label>Place<input name="location" value="${esc(m.location || e.location || '')}" maxlength="200"></label>${m.pin ? '<label class="check"><input type="checkbox" name="removePin">Remove photo GPS location</label>':''}<p class="fine">This changes the photo’s place in Memories. The care entry keeps its own time.</p><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save details</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`);
  $('photo-metadata-form').onsubmit=safe(async ev=>{
    ev.preventDefault();const data=new FormData(ev.target),wall=String(data.get('wall')),timezone=String(data.get('zone')).trim();
    const times=wallInstants(wall,timezone);
    if(times.length!==1 || times[0]>Date.now()+60000)throw Error('Check the date and time zone. Use an unambiguous time up to now.');
    await sync.enqueue('photoMetadata',e.id,{photoId:p.id,metadata:{...m,wall,timezone,capturedAt:times[0],location:String(data.get('location')).trim(),origin:'manual',...(data.has('removePin')?{pin:null}:{})}});
    detail(e.id);render();toast('Photo details saved');
  });
}));

async function photoFile(file) {
  if (file.size > 40000000)
    throw new Error("Please choose a photo smaller than 40 MB.");
  const url = URL.createObjectURL(file),
    img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(
          new Error(
            "This photo format could not be opened. Choose a JPEG or a photo from your camera.",
          ),
        );
      img.src = url;
    });
    const scale = Math.min(
        1,
        1800 / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob)
      throw new Error("Could not prepare this photo. Please try another.");
    if (blob.size > 2400000)
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.65));
    if (!blob || blob.size > 2500000)
      throw new Error("This photo is too large. Please choose a smaller copy.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function choosePhoto(target, camera = false) {
  state.photoTarget = target;
  const input = $(camera ? "camera-input" : "library-input");
  input.value = "";
  input.click();
}
function savedPhotos(id, ids) {
  const entry = sync.view().events.find((e) => e.id === id);
  if (!entry) return;
  openDialog(
    `<h2 id="dialog-title">Photo saved</h2><div class="saved-photos">${(
      entry.photos || []
    )
      .filter((p) => ids.includes(p.id))
      .map(
        (p) =>
          `<figure><img src="${esc(photoURLs.get(p.id))}" data-photo="${esc(p.id)}" alt="Saved care photo">${isCarePhoto(entry) ? `<figcaption><button class="px btn" data-keep-photo="${esc(p.id)}" data-id="${esc(id)}" aria-pressed="${p.keepsake === true}">${p.keepsake ? "Kept in Winnie" : "Keep in Winnie"}</button></figcaption>` : ""}</figure>`,
      )
      .join(
        "",
      )}</div><div class="button-row"><button class="primary" data-act="close">Done</button><button class="text-button" data-open="${esc(id)}">View care entry</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  hydratePhotos();
}
for (const id of ["camera-input", "library-input"])
  $(id).onchange = safe(async (e) => {
    const files = Array.from(e.target.files || []),
      target = state.photoTarget,
      albumDraft = draft;
    const attached = [];
    if (!files.length) return;
    if (files.length > 100) throw Error('Choose up to 100 photos at a time. You can add another batch after saving.');
    const fingerprints = new Set(facts().filter(e=>e.type==='moment').flatMap(e=>(e.photos||[]).map(p=>p.metadata?.fingerprint)).filter(Boolean));
    if (target === "album") {
      if (!albumDraft || albumDraft.busy || albumDraft.preparing) return;
      albumDraft.preparing = true;
      $("form-error").textContent = "";
      renderDraft();
    }
    toast("Preparing photo");
    try {
      for (const file of files) {
        if (file.size > 40000000) throw Error('Please choose a photo smaller than 40 MB.');
        const metadata = await readPhotoMetadata(file);
        if (id === 'camera-input' && !metadata.wall) {
          metadata.capturedAt = Date.now(); metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          metadata.wall = wallTime(metadata.capturedAt, metadata.timezone); metadata.origin = 'camera';
        }
        if (metadata.pin) {
          await loadCities().catch(() => {});
          const city = cityFor({placePin: metadata.pin});
          if (city) metadata.location = cityLabel(city);
        }
        const blob = await photoFile(file);
        if (target === "album") {
          if (!albumDraft || draft !== albumDraft || albumDraft.busy) return;
          if (albumDraft.items.some(item => item.metadata.fingerprint === metadata.fingerprint) ||
              fingerprints.has(metadata.fingerprint)) {
            toast('This photo is already in Winnie.'); continue;
          }
          albumDraft.items.push({ id: uid(), photoId: uid(), blob, metadata, url: URL.createObjectURL(blob) });
          markDialogDirty();
          renderDraft();
        } else if (target === "form") {
          if (!$("event-form")) return;
          state.formPhotos.push({blob, metadata, photoId: uid()});
          markDialogDirty();
          $("form-photo-status").textContent =
            `${state.formPhotos.length} ${state.formPhotos.length === 1 ? "photo" : "photos"} ready to keep.`;
        } else {
          const photoId = await sync.addPhoto(target, blob, metadata);
          photoURLs.set(photoId, URL.createObjectURL(blob));
          attached.push(photoId);
        }
      }
      if (target === "album") toast("Photos ready to save");
      else if (target !== "form") {
        toast(
          `${files.length === 1 ? "Photo" : "Photos"} saved on this device.`,
        );
        if (state.quickPhotoId === target) {
          state.quickPhotoId = null;
          savedPhotos(target, attached);
        } else if ($("dialog").open && state.detailId === target)
          detail(target);
        render();
      } else toast("Photo attached. Save to keep it.");
    } finally {
      if (target === "album" && albumDraft === draft) {
        albumDraft.preparing = false;
        renderDraft();
      }
    }
  });
export function download(value, name, type = "application/json") {
  const blob =
      value instanceof Blob
        ? value
        : new Blob([JSON.stringify(value, null, 2)], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
