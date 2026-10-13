// Photo picking, resizing, and saving.
import { $, clock, dateLabel, dateTime, esc, uid } from "./format.js?v=4.15";
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
} from "./ui.js?v=4.15";
import { isCarePhoto } from "../keepsakes.js?v=4.15";
import { facts, sync, photoURLs } from "./services.js?v=4.15";
import { detail, eventLabel, hydratePhotos } from "./entries.js?v=4.15";
import { icon } from "../icons.js?v=4.0";
import { render } from "./today.js?v=4.15";
import { state } from "./state.js?v=4.15";

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
    `<h2 id="dialog-title">Add photos</h2><form id="photo-composer"><div class="photo-composer-pick"><button type="button" class="primary" data-album-library>${icon("photo", "ic sm")} Choose photos</button><button type="button" class="secondary" data-album-camera>Take photo</button></div><div id="photo-draft" class="photo-draft"></div><p id="photo-draft-status" class="fine" role="status">No photos selected</p><label>Caption <span class="fine">(optional)</span><textarea name="note" maxlength="10000" placeholder="Add a caption"></textarea></label><label>Date taken<input name="time" type="datetime-local" value="${dateTime(Date.now())}" required></label><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary" type="submit" disabled>Save photos</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  draft = {
    id: restored?.id || uid(),
    items: (restored?.items || []).map((item) => ({
      blob: item.blob,
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
      items: current.items.map((item) => ({ blob: item.blob })),
      fields: draftFields(composer),
    }),
  );
  composer.elements.note.disabled = current.saved;
  composer.elements.time.disabled = current.saved;
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
      if (!current.saved) {
        await sync.enqueue("create", current.id, {
          type: "moment",
          time: new Date(data.get("time")).getTime(),
          note: String(data.get("note")).trim(),
          who: "us",
          tags: [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          retroactive: true,
        });
        current.saved = true;
        persistDialogDraft();
      }
      while (current.items.length) {
        const item = current.items[0];
        await sync.addPhoto(current.id, item.blob);
        current.items.shift();
        URL.revokeObjectURL(item.url);
        persistDialogDraft();
      }
      closeDialog();
      clearDraft();
      render();
      toast("Photos saved", () => sync.enqueue("delete", current.id));
    } finally {
      current.busy = false;
      if (form.isConnected) {
        form
          .querySelectorAll("button, input, textarea")
          .forEach((el) => (el.disabled = false));
        // A retry finishes attachments to the same saved entry.
        form.elements.note.disabled = current.saved;
        form.elements.time.disabled = current.saved;
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
  $("photo-draft").innerHTML = draft.items
    .map(
      (item, index) =>
        `<figure><img src="${item.url}" alt="Selected photo ${index + 1}"><button type="button" data-remove-draft="${index}" aria-label="Remove selected photo ${index + 1}">Remove</button></figure>`,
    )
    .join("");
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
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
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
    const files = Array.from(e.target.files || []).slice(0, 20),
      target = state.photoTarget,
      albumDraft = draft;
    const attached = [];
    if (!files.length) return;
    if (target === "album") {
      if (!albumDraft || albumDraft.busy || albumDraft.preparing) return;
      albumDraft.preparing = true;
      $("form-error").textContent = "";
      renderDraft();
    }
    toast("Preparing photo");
    try {
      for (const file of files) {
        const blob = await photoFile(file);
        if (target === "album") {
          if (!albumDraft || draft !== albumDraft || albumDraft.busy) return;
          albumDraft.items.push({ blob, url: URL.createObjectURL(blob) });
          markDialogDirty();
          renderDraft();
        } else if (target === "form") {
          if (!$("event-form")) return;
          state.formPhotos.push(blob);
          markDialogDirty();
          $("form-photo-status").textContent =
            `${state.formPhotos.length} ${state.formPhotos.length === 1 ? "photo" : "photos"} ready to keep.`;
        } else {
          const photoId = await sync.addPhoto(target, blob);
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
