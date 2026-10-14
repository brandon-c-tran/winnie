import { recordDay } from '../lifetime.js?v=4.18';
import { isCarePhoto } from "../keepsakes.js?v=4.18";
import { createReactionPicker } from "./reaction-picker.js?v=4.18";
// Entry rows, reactions, the entry detail sheet, and photo loading.
import { QUALITY } from "../pantry.js?v=4.18";
import { placeLabel } from "../places.js?v=4.18";
import { icon, typeIcon, typeColor } from "../icons.js?v=4.0";
import { photoCaption } from "../everyday.js?v=4.18";
import { photoLoading, photoURLs, room, sync } from "./services.js?v=4.18";
import { TYPES, clock, dateLabel, esc, person, face } from "./format.js?v=4.18";
import { openDialog, safe, toast } from "./ui.js?v=4.18";
import { placeSummary } from "./forms.js?v=4.18";
import { state } from "./state.js?v=4.18";

document.addEventListener("click", safe(async ev => {
  const button = ev.target.closest("[data-keep-photo]");
  if (!button) return;
  button.disabled = true;
  try {
    const event = sync.view().events.find(e => e.id === button.dataset.id);
    const photo = event?.photos?.find(p => p.id === button.dataset.keepPhoto);
    if (!photo) throw Error("This photo is no longer attached.");
    await sync.enqueue("keepPhoto", event.id, {photoId: photo.id, keep: !photo.keepsake});
    button.textContent = photo.keepsake ? "Keep in Winnie" : "Kept in Winnie";
    button.setAttribute("aria-pressed", String(!photo.keepsake));
    toast(photo.keepsake ? "Removed from Winnie. Care photo kept." : "Kept in Winnie. Care photo stays attached.");
  } finally { button.disabled = false; }
}));
const pendingReactions = new Set();
const picker = createReactionPicker({
  choices: [
    ["❤️", "Love"],
    ["😂", "Laugh"],
    ["👏", "Clap"],
  ],
  getMine: (id) =>
    sync.view().events.find((e) => e.id === id)?.reactions?.[
      sync.session?.person
    ]?.emoji,
  choose: safe(async (id, emoji) => {
    if (pendingReactions.has(id)) return;
    pendingReactions.add(id);
    refreshReactions();
    try {
      await sync.enqueue("react", id, { emoji });
      if (emoji) room.react("heart");
    } finally {
      pendingReactions.delete(id);
      refreshReactions();
    }
  }),
});
const reactionEmojis = ["❤️", "😂", "👏"];
function reactions(e) {
  if (e.deletedAt) return "";
  const groups = reactionEmojis
    .map((emoji) => ({
      emoji,
      people: Object.entries(e.reactions || {})
        .filter(([, r]) => r.emoji === emoji)
        .map(([p]) => person(p)),
    }))
    .filter((g) => g.people.length);
  const description = groups
    .map((g) => g.emoji + " " + g.people.join(" and "))
    .join(", ");
  return `<div class="entry-reactions" data-reactions-for="${esc(e.id)}"><button class="reaction-trigger ${groups.length ? "has-reactions" : ""}" data-reaction-picker="${esc(e.id)}" aria-expanded="false" ${pendingReactions.has(e.id) ? 'disabled aria-busy="true"' : ""} aria-label="${esc(description ? description + ". Add or change your reaction" : "React to this entry")}">${groups.length ? groups.map((g) => `<span class="reaction-total"><span aria-hidden="true">${g.emoji}</span><span>${g.people.length}</span></span>`).join("") : '<span aria-hidden="true">' + icon("heartOpen") + '</span><span class="sr-only">React</span>'}</button></div>`;
}
document.addEventListener("click", (ev) => {
  const trigger = ev.target.closest("[data-reaction-picker]");
  if (trigger && !pendingReactions.has(trigger.dataset.reactionPicker))
    picker.open(trigger);
});
export function refreshReactions() {
  picker.refresh();
  const events = sync.view().events;
  document.querySelectorAll("[data-reactions-for]").forEach((node) => {
    const e = events.find((e) => e.id === node.dataset.reactionsFor);
    if (!e || e.deletedAt) {
      node.remove();
      return;
    }
    const holder = document.createElement("div");
    holder.innerHTML = reactions(e);
    const next = holder.querySelector("button"),
      current = node.querySelector("button");
    if (!current) return;
    current.innerHTML = next.innerHTML;
    current.className = next.className;
    current.disabled = next.disabled;
    current.setAttribute("aria-label", next.getAttribute("aria-label"));
    current.setAttribute("aria-busy", String(next.disabled));
  });
  picker.refresh();
}

function entryFacts(e, duration) {
  const quality = (e.tags || []).filter((tag) => QUALITY.includes(tag));
  const tags = (e.tags || []).filter((tag) => !QUALITY.includes(tag));
  return [
    [
      "Consistency",
      quality.map((q) => q[0].toUpperCase() + q.slice(1)).join(", "),
    ],
    ["Place", placeLabel(e)],
    ["Food", e.foods?.join(" + ")],
    ["Duration", duration],
    ["Details", tags.join(", ")],
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<span class="entry-fact"><span class="fact-label">${label}</span><span>${esc(value)}</span></span>`,
    )
    .join("");
}

const entryClock = e => {
  if (["date","day","unknown","interval"].includes(e.time_precision)) return 'Time not exact';
  try { return new Intl.DateTimeFormat([], {timeZone:e.timezone || 'America/Los_Angeles',hour:'numeric',minute:'2-digit'}).format(e.time); } catch {return clock(e.time);}
};
const entryDay = e => dateLabel(new Date(recordDay(e)+'T12:00').getTime());
function entryDate(e) {
  return `<dl class="entry-dates"><div><dt>Date</dt><dd>${entryDay(e)}</dd></div><div><dt>${e.end_time != null ? "Started" : "Time"}</dt><dd>${entryClock(e)}</dd></div>${e.end_time != null ? `<div><dt>Ended</dt><dd>${dateLabel(e.end_time) !== dateLabel(e.time) ? dateLabel(e.end_time) + "<br>" : ""}${clock(e.end_time)}</dd></div>` : ""}</dl>`;
}

function rowResult(e) {
  if (e.type === "poop") {
    const quality = (e.tags || []).filter((tag) => QUALITY.includes(tag));
    if (quality.length)
      return (
        quality.map((q) => q[0].toUpperCase() + q.slice(1)).join(", ") +
        " stool"
      );
  }
  if (e.type === "meal" && e.foods?.length) return e.foods.join(", ");
  if (e.end_time != null)
    return e.end_time < e.time
      ? "Time needs review"
      : `${Math.round((e.end_time - e.time) / 60000)} min`;
  if (["nap", "slumber", "walk"].includes(e.type)) return e.historical ? "End not recorded" : "In progress";
  return "";
}

export function entry(e, { photoRecord = false, fullPhoto = false } = {}) {
  const result = rowResult(e);
  const author = person(e.loggedBy);
  const portrait = face(e.loggedBy, "record");
  const signature = portrait
    ? `<span class="record-author" aria-label="Logged by ${esc(author)}">${portrait}<span>${esc(author)}</span></span>`
    : `<span class="record-author"><span class="sq" style="--c:${typeColor(e.type)}" aria-hidden="true">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span></span>`;
  const photo = photoRecord && e.photos?.length ? e.photos[0] : null;
  return `<div class="feed-entry signed-entry${photo ? ` care-photo-record${fullPhoto ? " full-photo-record" : " compact-photo-record"}` : ""}${e.id === state.freshEntry ? " fresh" : ""}">
    <button class="entry" data-open="${esc(e.id)}"><span class="entry-body"><span class="entry-title">${esc(eventLabel(e))}</span>${result ? `<span class="entry-result">${esc(result)}</span>` : ""}${e.note && e.note !== eventLabel(e) ? `<span class="entry-note">${esc(e.note)}</span>` : ""}${signature}${e.pending ? '<span class="pending-dot">Not sent</span>' : ""}</span></button>
    ${photo ? `<button class="record-photo" data-open="${esc(e.id)}" aria-label="Open ${e.photos.length} ${e.photos.length === 1 ? "photo" : "photos"} from ${esc(eventLabel(e))}"><img data-photo="${esc(photo.id)}" alt="${esc(photoCaption(e))}" loading="lazy">${e.photos.length > 1 ? `<span>${e.photos.length} photos</span>` : ""}</button>` : ""}
    <div class="entry-footer"><time class="entry-time" datetime="${new Date(e.time).toISOString()}">${entryClock(e)}</time>${!photo && e.photos?.length ? `<button class="entry-photo-link" data-open="${esc(e.id)}">${icon("photo", "ic sm")}<span>${e.photos.length} ${e.photos.length === 1 ? "photo" : "photos"}</span></button>` : ""}${reactions(e)}</div>
  </div>`;
}

export async function hydratePhotos() {
  for (const img of document.querySelectorAll("img[data-photo]")) {
    const id = img.dataset.photo;
    if (photoURLs.has(id)) {
      img.src = photoURLs.get(id);
      continue;
    }
    if (photoLoading.has(id)) continue;
    photoLoading.add(id);
    sync
      .photo(id)
      .then((blob) => {
        photoURLs.set(id, URL.createObjectURL(blob));
        document.querySelectorAll("img[data-photo]").forEach((el) => {
          if (el.dataset.photo === id) el.src = photoURLs.get(id);
        });
      })
      .catch(() => {
        img.alt = "Photo unavailable offline · reconnect to load";
      })
      .finally(() => photoLoading.delete(id));
  }
}
export function detail(id) {
  const e = sync.view().events.find((e) => e.id === id);
  if (!e) {
    toast("This entry isn’t available yet. Refresh to try again.");
    return;
  }
  if (e.deletedAt) {
    openDialog(
      `<h2 id="dialog-title">Entry removed</h2><p>${esc(eventLabel(e))}</p>${entryDate(e)}<div class="button-row"><button class="secondary" data-restore="${esc(id)}">Restore entry</button></div><p id="form-error" class="error"></p>`,
    );
    return;
  }
  openDialog(
    `<article class="entry-detail">
      <div class="detail-intro">${face(e.loggedBy, "detail-portrait") || `<span class="sq" style="--c:${typeColor(e.type)}">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span>`}<div class="detail-intro-copy"><header class="detail-heading"><h2 id="dialog-title">${esc(eventLabel(e))}</h2><button class="text-button" data-edit="${esc(id)}">Edit entry</button></header><p class="detail-author">${person(e.loggedBy) ? `Logged by <strong>${esc(person(e.loggedBy))}</strong>` : "Person not recorded"}</p></div></div>
      <div class="detail-byline">${entryDate(e)}${reactions(e)}</div>
      ${e.provenance ? `<details class="detail-section"><summary>Original note</summary><p>${esc(e.provenance.header || '')}</p><pre class="source-note">${esc(e.provenance.raw || e.provenance.text || '')}</pre><p class="fine">${esc((e.provenance.flags || []).join('; '))}</p>${!e.provenance.reviewed && e.provenance.flags?.length ? `<button class="text-button" data-review-note="${esc(e.id)}">Mark source question reviewed</button>` : ''}<p class="fine">${esc(e.provenance.file || '')} ${e.provenance.line ? 'line '+e.provenance.line : ''}</p></details>` : ''}
      ${e.pending ? '<p class="pending-dot">Not sent yet</p>' : ""}
      ${e.end_time != null && e.end_time < e.time ? '<p class="error">This historical end time is before its start. Edit the entry to correct it; its original value has been preserved.</p>' : ""}
      ${e.note ? `<p class="detail-notes">${esc(e.note)}</p>` : ""}
      ${e.foods?.length || (e.who && e.who !== "us") || e.tags?.some((t) => !QUALITY.includes(t)) ? `<div class="detail-facts">${entryFacts({ foods: e.foods, tags: (e.tags || []).filter((t) => !QUALITY.includes(t)) }, "")}${e.who && e.who !== "us" ? `<span class="entry-fact"><span class="fact-label">Care by</span><span>${esc(e.who)}</span></span>` : ""}</div>` : ""}
      ${e.type === "poop" ? `<section class="detail-section"><h3>Consistency</h3><div class="signal-buttons">${QUALITY.map((q) => `<button aria-pressed="${e.tags?.includes(q) || false}" data-quality="${q}" data-id="${esc(id)}" class="${e.tags?.includes(q) ? "selected" : ""}">${q[0].toUpperCase() + q.slice(1)}</button>`).join("")}</div></section>` : ""}
      <section class="detail-section detail-place"><div class="detail-section-heading"><h3>Place</h3><button class="text-button" data-place="${esc(id)}">${placeLabel(e) ? "Edit place" : "Add place"}</button></div>${placeLabel(e) ? placeSummary(e) : '<p class="fine">No place recorded</p>'}</section>
      <section class="detail-section"><div class="detail-section-heading"><h3>Photos${e.photos?.length ? ` <span class="fine">${e.photos.length}</span>` : ""}</h3><div class="detail-photo-add"><button class="text-button" data-photo-camera="${esc(id)}">Take photo</button><button class="text-button" data-photo-library="${esc(id)}">Choose photo</button></div></div>${(e.photos || []).map((p) => `<figure class="detail-image"><img class="detail-photo" data-photo="${esc(p.id)}" alt="${esc(photoCaption(e))}"><figcaption class="photo-actions">${isCarePhoto(e) ? `<button class="text-button" data-keep-photo="${esc(p.id)}" data-id="${esc(id)}" aria-pressed="${p.keepsake === true}">${p.keepsake ? "Kept in Winnie" : "Keep in Winnie"}</button>` : ""}<button class="text-button" data-edit-photo-meta="${esc(p.id)}" data-id="${esc(id)}">Date & place</button><button class="text-button" data-download-photo="${esc(p.id)}">Save photo</button><button class="text-button danger" data-remove-photo="${esc(p.id)}" data-id="${esc(id)}">Remove photo</button></figcaption></figure>`).join("")}${!e.photos?.length ? '<p class="fine">No photos attached</p>' : ""}</section>
      ${["pee", "poop"].includes(e.type) ? `<section class="detail-section"><h3>Who started it?</h3><div class="signal-buttons">${["He asked", "We took him out"].map((s) => `<button aria-pressed="${e.signal === s}" data-signal="${s}" data-id="${esc(id)}" class="${e.signal === s ? "selected" : ""}">${s}</button>`).join("")}</div></section>` : e.signal ? `<p>${esc(e.signal)}</p>` : ""}
      <footer class="detail-section"><button class="text-button danger" data-delete="${esc(id)}">Remove entry</button></footer><p id="form-error" class="error" role="alert"></p>
    </article>`,
  );
  state.detailId = id;
  hydratePhotos();
}
export function eventLabel(e) {
  if (e.careTitle) return e.careTitle;
  return e.type === "covered_gap" &&
    (e.kind === "trainer" || e.who === "trainer")
    ? "Trainer visit"
    : TYPES[e.type]?.[1] || e.type;
}
