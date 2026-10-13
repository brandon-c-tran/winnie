// Toasts, the sheet (one <dialog>), error handling, and memoised HTML writes.
import { $ } from "./format.js?v=4.2";
import { room } from "./services.js?v=4.2";
import { state } from "./state.js?v=4.2";

let toastTimer;
export function toast(message, undo = null, actions = []) {
  $("toast-text").textContent = message.replace(" · ", "\n");
  $("toast-text").style.whiteSpace = "pre-line";
  $("toast").hidden = false;
  $("undo").hidden = !undo;
  state.lastUndo = undo;
  const box = $("toast-actions");
  box.replaceChildren(
    ...actions.map(([label, fn]) => {
      const b = document.createElement("button");
      b.textContent = label;
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
export function openDialog(html) {
  const d = $("dialog");
  clearTimeout(closingTimer);
  d.classList.remove("closing");
  if (!d.open) state.dialogReturn = document.activeElement;
  $("dialog-content").innerHTML = html;
  state.detailId = null;
  if (!d.open) {
    d.showModal();
    room?.pause(true);
  }
}
export function closeDialog() {
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
  state.dialogReturn?.focus?.();
}
$("dialog-close").onclick = closeDialog;
$("dialog").addEventListener("close", () => room?.pause(false));
$("dialog").addEventListener("click", (ev) => {
  // Tapping the dimmed area above a sheet closes it.
  if (ev.target === $("dialog")) closeDialog();
});
document.addEventListener("touchstart", () => {}, { passive: true });
$("dialog").addEventListener("cancel", () => {
  state.detailId = null;
  state.formPhotos = [];
  state.formType = null;
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
