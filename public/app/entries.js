// Entry rows, reactions, the entry detail sheet, and photo loading.
import { QUALITY } from "../pantry.js?v=4.4";
import { placeLabel } from "../places.js?v=4.4";
import { icon, typeIcon, typeColor } from "../icons.js?v=4.0";
import { photoCaption } from "../everyday.js?v=4.4";
import { photoLoading, photoURLs, room, sync } from "./services.js?v=4.4";
import { TYPES, clock, dateLabel, esc, person, face } from "./format.js?v=4.4";
import { openDialog, safe, toast } from "./ui.js?v=4.4";
import { placeSummary } from "./forms.js?v=4.4";
import { state } from "./state.js?v=4.4";

let reactionPickerId = null;
const reactionEmojis = ["❤️", "😂", "👏"];
function reactions(e) {
  if (e.deletedAt) return "";
  const mine = e.reactions?.[sync.session?.person]?.emoji;
  const groups = reactionEmojis
    .map((emoji) => ({
      emoji,
      people: Object.entries(e.reactions || {})
        .filter(([, r]) => r.emoji === emoji)
        .map(([p]) => person(p)),
    }))
    .filter((g) => g.people.length);
  const expanded = reactionPickerId === e.id;
  const description = groups
    .map((g) => g.emoji + " " + g.people.join(" and "))
    .join(", ");
  return `<div class="entry-reactions" data-reactions-for="${esc(e.id)}"><button class="reaction-trigger ${groups.length ? "has-reactions" : ""}" data-reaction-picker="${esc(e.id)}" aria-expanded="${expanded}" aria-label="${esc(description ? description + ". Add or change your reaction" : "React to this entry")}">${groups.length ? groups.map((g) => `<span class="reaction-total"><span aria-hidden="true">${g.emoji}</span><span>${g.people.length}</span></span>`).join("") : '<span aria-hidden="true">' + icon("heartOpen") + '</span><span class="sr-only">React</span>'}</button>${expanded ? `<div class="reaction-picker" role="group" aria-label="Choose your reaction">${reactionEmojis.map((emoji) => `<button class="reaction-chip" data-react="${emoji}" data-event="${esc(e.id)}" aria-label="${mine === emoji ? "Remove your" : "React with"} ${emoji} reaction" aria-pressed="${mine === emoji}">${emoji}</button>`).join("")}</div>` : ""}</div>`;
}
document.addEventListener(
  "click",
  safe(async (ev) => {
    const trigger = ev.target.closest("[data-reaction-picker]");
    if (trigger) {
      reactionPickerId =
        reactionPickerId === trigger.dataset.reactionPicker
          ? null
          : trigger.dataset.reactionPicker;
      refreshReactions();
      return;
    }
    const b = ev.target.closest("[data-react]");
    if (b) {
      const e = sync.view().events.find((e) => e.id === b.dataset.event);
      if (!e || e.deletedAt) return;
      const emoji =
        e.reactions?.[sync.session.person]?.emoji === b.dataset.react
          ? ""
          : b.dataset.react;
      const host = b.closest("[data-reactions-for]");
      reactionPickerId = null;
      await sync.enqueue("react", e.id, { emoji });
      refreshReactions();
      const target = host.isConnected
        ? host
        : [...document.querySelectorAll("[data-reactions-for]")].find(
            (n) => n.dataset.reactionsFor === e.id && n.getClientRects().length,
          );
      target
        ?.querySelector("[data-reaction-picker]")
        ?.focus({ preventScroll: true });
      if (emoji) room.react("heart");
      return;
    }
    if (reactionPickerId && !ev.target.closest(".entry-reactions")) {
      reactionPickerId = null;
      refreshReactions();
    }
  }),
);
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape" || !reactionPickerId) return;
  ev.preventDefault();
  ev.stopPropagation();
  const host = document.activeElement.closest("[data-reactions-for]");
  reactionPickerId = null;
  refreshReactions();
  host?.querySelector("[data-reaction-picker]")?.focus({ preventScroll: true });
});
export function refreshReactions() {
  const events = sync.view().events;
  document.querySelectorAll("[data-reactions-for]").forEach((node) => {
    const e = events.find((e) => e.id === node.dataset.reactionsFor);
    if (!e || e.deletedAt) {
      node.remove();
      return;
    }
    const focused = node.contains(document.activeElement);
    const selected = document.activeElement.dataset.react;
    const holder = document.createElement("div");
    holder.innerHTML = reactions(e);
    if (node.innerHTML === holder.firstElementChild.innerHTML) return;
    node.innerHTML = holder.firstElementChild.innerHTML;
    if (focused) {
      const choice = [...node.querySelectorAll("[data-react]")].find(
        (b) => b.dataset.react === selected,
      );
      (choice || node.querySelector("[data-reaction-picker]"))?.focus({
        preventScroll: true,
      });
    }
  });
}
export function entry(e) {
  const duration =
    e.end_time != null
      ? e.end_time < e.time
        ? "Time needs review"
        : `${Math.round((e.end_time - e.time) / 60000)} min`
      : ["nap", "slumber", "walk"].includes(e.type)
        ? "In progress"
        : "";
  const detail = [
    e.foods?.join(" + "),
    placeLabel(e),
    person(e.loggedBy),
    duration,
    e.note !== eventLabel(e) ? e.note : "",
    ...(e.tags || []),
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="feed-entry${e.id === state.freshEntry ? " fresh" : ""}"><button class="entry" data-open="${esc(e.id)}"><span class="entry-symbol sq" style="--c:${typeColor(e.type)}" aria-hidden="true">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span><span class="entry-body"><span class="entry-title">${esc(eventLabel(e))}</span><span class="entry-note">${esc(detail)}</span></span><span class="entry-time">${face(e.loggedBy, "xs")}${clock(e.time)}${e.pending ? '<br><span class="pending-dot">Not sent</span>' : ""}</span></button>${e.photos?.length ? `<div class="feed-photos">${e.photos.map((p) => `<button data-open="${esc(e.id)}" aria-label="Open photo from ${esc(eventLabel(e))}"><img data-photo="${esc(p.id)}" alt="${esc(photoCaption(e))}" loading="lazy"></button>`).join("")}</div>` : ""}${reactions(e)}</div>`;
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
      `<h2 id="dialog-title">Entry removed</h2><p class="fine">${esc(eventLabel(e))} · ${dateLabel(e.time)} · ${clock(e.time)}</p><div class="button-row"><button class="secondary" data-restore="${esc(id)}">Restore entry</button></div><p id="form-error" class="error"></p>`,
    );
    return;
  }
  openDialog(
    `<div class="detail-head"><span class="sq" style="--c:${typeColor(e.type)}">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span><h2 id="dialog-title">${esc(eventLabel(e))}</h2></div><p class="fine">${dateLabel(e.time)} · ${clock(e.time)}${e.end_time != null ? ` → ${dateLabel(e.end_time)} ${clock(e.end_time)}` : ""}</p><p class="fine">${e.loggedBy ? `Logged by ${esc(person(e.loggedBy))}` : "From the original log · person not recorded"}${e.pending ? " · not sent yet" : ""}</p>${e.end_time != null && e.end_time < e.time ? '<p class="error">This historical end time is before its start. You can correct it below; its original value has been preserved.</p>' : ""}${reactions(e)}<div class="detail-meta">${(e.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}${e.who && e.who !== "us" ? `<span class="pill">Care by ${esc(e.who)}</span>` : ""}${e.signal ? `<span class="pill">${esc(e.signal)}</span>` : ""}</div>${e.foods?.length ? `<p class="detail-notes">Ate ${esc(e.foods.join(" + "))}</p>` : ""}${e.note ? `<p class="detail-notes">${esc(e.note)}</p>` : ""}${placeSummary(e)}<button class="text-button" data-place="${esc(id)}">⌖ ${placeLabel(e) ? "Edit place" : "Add place"}</button><div class="button-row"><button class="primary small" data-photo-camera="${esc(id)}">Take photo</button><button class="secondary small" data-photo-library="${esc(id)}">Choose photo</button><button class="text-button" data-edit="${esc(id)}">Edit entry</button></div>${e.type === "poop" ? `<h3>How was it?</h3><div class="signal-buttons">${QUALITY.map((q) => `<button data-quality="${q}" data-id="${esc(id)}" class="${e.tags?.includes(q) ? "selected" : ""}">${q[0].toUpperCase() + q.slice(1)}</button>`).join("")}</div>` : ""}${["pee", "poop"].includes(e.type) ? `<h3>Who started it?</h3><div class="signal-buttons">${["He asked", "We took him out"].map((s) => `<button data-signal="${s}" data-id="${esc(id)}" class="${e.signal === s ? "selected" : ""}">${s}</button>`).join("")}</div>` : ""}${(e.photos || []).map((p) => `<img class="detail-photo" data-photo="${esc(p.id)}" alt="${esc(e.type === "poop" ? "Winnie’s poop photo" : "A moment with Winnie")}"><div class="photo-actions"><button class="text-button" data-download-photo="${esc(p.id)}">Save photo</button><button class="text-button danger" data-remove-photo="${esc(p.id)}" data-id="${esc(id)}">Remove from entry</button></div>`).join("")}<div class="button-row"><button class="text-button danger" data-delete="${esc(id)}">Remove entry</button></div><p id="form-error" class="error" role="alert"></p>`,
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
