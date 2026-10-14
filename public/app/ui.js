// Toasts, the sheet (one <dialog>), error handling, and memoised HTML writes.
import { icon } from "../icons.js?v=4.0";
import { $ } from "./format.js?v=4.18";
import { room, sync } from "./services.js?v=4.18";
import { state } from "./state.js?v=4.18";
import { createDraftStore } from "../draft-store.js?v=4.18";

let toastTimer;
export function toast(message, undo = null, actions = []) {
  $("toast-text").textContent = message.replace(" · ", "\n");
  $("toast-text").style.whiteSpace = "pre-line";
  $("toast").hidden = false;
  $("undo").hidden = !undo;
  state.lastUndo = undo;
  const box = $("toast-actions");
  box.replaceChildren(
    // An action is [label, run] or [label, run, iconName]; icon actions stay compact.
    ...actions.map(([label, fn, iconName]) => {
      const b = document.createElement("button");
      if (iconName) {
        b.innerHTML = icon(iconName, "ic sm");
        b.setAttribute("aria-label", label);
        b.className = "toast-icon";
      } else b.textContent = label;
      b.onclick = () => {
        $("toast").hidden = true;
        state.lastUndo = null;
        safe(fn)();
      };
      return b;
    }),
  );
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
      state.lastUndo = null;
    },
    undo || actions.length ? 8000 : 5000,
  );
}
export function error(err) {
  const box = $("form-error");
  if ($("dialog").open && box) box.textContent = err.message;
  else toast(err.message);
}
export function safe(fn) {
  return (...args) => {
    try {
      return Promise.resolve(fn(...args)).catch(error);
    } catch (err) {
      error(err);
    }
  };
}
let closingTimer = 0;
let draftKey = null,
  draftResume = null,
  draftDiscard = null,
  draftCapture = null,
  dirty = false;
const drafts = new Map();
const draftStore = createDraftStore();
let draftStorageFailed = false;
export const hasDialogDrafts = () => dirty || drafts.size > 0;
window.addEventListener("beforeunload", (event) => {
  if (draftStorageFailed && hasDialogDrafts()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
export async function restoreDrafts() {
  if (!sync.session) return;
  try {
    for (const saved of await draftStore.list(sync.session.home))
      drafts.set(saved.key, saved);
    renderDrafts();
  } catch {
    draftStorageFailed = true;
  }
}
export function persistDialogDraft() {
  if (!dirty || !draftKey || !draftCapture) return;
  const saved = {
    key: draftKey,
    home: sync.session.home,
    title: $("dialog-title")?.textContent || "Unfinished entry",
    data: draftCapture(),
  };
  return draftStore.put(saved).catch(() => {
    draftStorageFailed = true;
    toast(
      "Draft is open, but could not be saved on this phone. Keep this page open.",
    );
  });
}
export function draftFields(form) {
  return Object.fromEntries(
    [...form.elements]
      .filter((el) => el.name && el.type !== "file")
      .map((el) => [el.name, el.value]),
  );
}
export function applyDraftFields(form, fields = {}) {
  for (const [name, value] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    if (input && input.type !== "file") input.value = value;
  }
}
export function retainDialogDraft(
  key,
  onResume = () => {},
  onDiscard = () => {},
  capture = null,
) {
  draftKey = key;
  draftResume = onResume;
  draftDiscard = onDiscard;
  draftCapture = capture;
}
function renderDrafts() {
  let box = $("unfinished-drafts");
  if (!box) {
    box = document.createElement("section");
    box.id = "unfinished-drafts";
    box.setAttribute("aria-label", "Unfinished entries");
    $("routine-care").before(box);
  }
  box.replaceChildren();
  for (const [key, saved] of drafts) {
    if (!key.includes(`:${sync.session?.home}`)) continue;
    const row = document.createElement("div"),
      label = document.createElement("span"),
      resume = document.createElement("button"),
      discard = document.createElement("button");
    label.textContent = saved.title;
    resume.textContent = "Resume";
    resume.className = "text-button";
    resume.setAttribute("aria-label", "Resume " + saved.title.toLowerCase());
    resume.onclick = () => resumeDialogDraft(key);
    discard.textContent = "Discard";
    discard.className = "text-button";
    discard.setAttribute("aria-label", "Discard " + saved.title.toLowerCase());
    discard.onclick = () => {
      if (!confirm("Discard this unfinished draft?")) return;
      saved.discard?.();
      drafts.delete(key);
      void draftStore.remove(key).catch(error);
      renderDrafts();
    };
    row.append(label, resume, discard);
    box.append(row);
  }
  box.hidden = !box.children.length;
}
export function markDialogDirty() {
  dirty = true;
  persistDialogDraft();
}
export function resumeDialogDraft(key) {
  const saved = drafts.get(key);
  if (!saved) return false;
  if (!saved.content) {
    drafts.delete(key);
    document.dispatchEvent(
      new CustomEvent("winnie:resume-draft", { detail: saved.data }),
    );
    dirty = true;
    renderDrafts();
    return true;
  }
  openDialog("");
  $("dialog-content").replaceChildren(saved.content);
  Object.assign(state, saved.state);
  retainDialogDraft(key, saved.resume, saved.discard, saved.capture);
  dirty = true;
  drafts.delete(key);
  renderDrafts();
  saved.resume();
  $("dialog-content").querySelector("input, textarea, button")?.focus();
  return true;
}
export function requestCloseDialog() {
  // Never dismiss an in-flight submission or photo preparation.
  const form = $("dialog-content").querySelector("form");
  if (
    form?.querySelector('[type="submit"]:disabled') &&
    (form.id !== "photo-composer" ||
      form.querySelector("input:disabled, textarea:disabled"))
  ) {
    toast("Wait for saving to finish.");
    return;
  }
  if (dirty && draftKey) {
    const title = $("dialog-title")?.textContent || "Unfinished entry";
    persistDialogDraft();
    const content = document.createDocumentFragment();
    content.append(...$("dialog-content").childNodes);
    drafts.set(draftKey, {
      content,
      title,
      resume: draftResume,
      discard: draftDiscard,
      capture: draftCapture,
      state: {
        formPhotos: state.formPhotos,
        formType: state.formType,
        detailId: state.detailId,
        quickPhotoId: state.quickPhotoId,
      },
    });
    draftKey = null;
    closeDialog();
    renderDrafts();
    toast("Draft kept on this phone. Reopen to continue.");
    return;
  }
  if (dirty && !confirm("Discard your unsaved changes?")) return;
  closeDialog();
}
export function openDialog(html) {
  document.dispatchEvent(new Event("winnie:surface-change"));
  const d = $("dialog");
  clearTimeout(closingTimer);
  d.classList.remove("closing");
  if (!d.open) state.dialogReturn = document.activeElement;
  $("dialog-content").innerHTML = html;
  draftKey = null;
  draftResume = null;
  draftDiscard = null;
  draftCapture = null;
  dirty = false;
  state.detailId = null;
  if (!d.open) {
    d.showModal();
    room?.pause(true);
  }
}
export function closeDialog() {
  if (draftKey) {
    drafts.delete(draftKey);
    void draftStore.remove(draftKey).catch(error);
  }
  draftKey = null;
  draftResume = null;
  draftDiscard = null;
  draftCapture = null;
  dirty = false;
  document.dispatchEvent(new Event("winnie:surface-change"));
  const d = $("dialog");
  if (d.open && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    d.classList.add("closing");
    clearTimeout(closingTimer);
    closingTimer = setTimeout(() => {
      d.classList.remove("closing");
      d.close();
    }, 150);
  } else d.close();
  room?.pause(false);
  state.detailId = null;
  state.quickPhotoId = null;
  state.formPhotos = [];
  state.formType = null;
  renderDrafts();
}
$("dialog-close").onclick = requestCloseDialog;
$("dialog").addEventListener("input", markDialogDirty);
$("dialog").addEventListener("change", markDialogDirty);
$("dialog").addEventListener("close", () => {
  room?.pause(false);
  const target = state.dialogReturn;
  if (target?.isConnected) target.focus();
  else document.querySelector(`#${state.tab}-view h1`)?.focus();
});
$("dialog").addEventListener("click", (ev) => {
  // Tapping the dimmed area above a sheet closes it.
  if (ev.target === $("dialog")) requestCloseDialog();
});
document.addEventListener("touchstart", () => {}, { passive: true });
$("dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  requestCloseDialog();
});
$("toast-close").onclick = () => {
  $("toast").hidden = true;
};
$("undo").onclick = safe(async () => {
  const undo = state.lastUndo;
  if (!undo) return;
  state.lastUndo = null;
  $("undo").disabled = true;
  try {
    await undo();
    toast("Undone");
  } finally {
    $("undo").disabled = false;
  }
});
export const renderedHTML = new Map();
export function html(id, value) {
  if (renderedHTML.get(id) !== value) {
    $(id).innerHTML = value;
    renderedHTML.set(id, value);
  }
}
