import { $, esc, person } from "./format.js?v=4.23";
import {
  openDialog,
  closeDialog,
  safe,
  toast,
  markDialogDirty,
} from "./ui.js?v=4.23";
import { sync } from "./services.js?v=4.23";
import { hydratePhotos } from "./entries.js?v=4.23";

export function recollectionsHTML(event, exceptPerson) {
  const words = Object.entries(event.recollections || {}).filter(
    ([by, r]) => r.text && by !== exceptPerson,
  );
  return words
    .map(
      ([by, r]) =>
        `<blockquote class="remembered-words"><p>${esc(r.text)}</p><footer>${esc(person(by))} remembers</footer></blockquote>`,
    )
    .join("");
}
export function remember(eventId, photoId) {
  const event = sync
    .view()
    .events.find((e) => e.id === eventId && !e.deletedAt);
  if (!event) throw Error("This memory is no longer available.");
  const mine = event.recollections?.[sync.session.person]?.text || "";
  const photo =
    event.photos?.find((p) => p.id === photoId) || event.photos?.[0];
  openDialog(
    `<h2 id="dialog-title">What do you remember?</h2>${photo ? `<img class="recollection-photo" data-photo="${esc(photo.id)}" alt="Winnie in this memory">` : ""}${recollectionsHTML(event, sync.session.person)}<form id="recollection-form"><label>Your recollection<textarea name="words" maxlength="1200" rows="4" placeholder="The little thing about this day you don’t want to forget…">${esc(mine)}</textarea></label><p class="fine">Saved as ${esc(person(sync.session.person))}. You and ${sync.session.person === "brandon" ? "Kim" : "Brandon"} each have your own words.</p><div class="button-row"><button class="primary">Save recollection</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
  );
  const form = $("recollection-form");
  form.oninput = markDialogDirty;
  form.onsubmit = safe(async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit],button.primary");
    button.disabled = true;
    try {
      await sync.enqueue("recollect", event.id, {
        text: form.elements.words.value,
        previous: mine,
      });
      closeDialog();
      toast("Recollection saved on this device.");
      document.dispatchEvent(new Event("winnie:story-change"));
    } finally {
      button.disabled = false;
    }
  });
  hydratePhotos();
}
document.addEventListener(
  "click",
  safe((e) => {
    const b = e.target.closest("[data-recollect]");
    if (b) remember(b.dataset.recollect, b.dataset.memoryPhoto);
  }),
);
