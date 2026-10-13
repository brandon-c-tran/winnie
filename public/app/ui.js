// Toasts, the sheet (one <dialog>), error handling, and memoised HTML writes.
import { icon } from "../icons.js?v=4.0";
import { $ } from "./format.js?v=4.9";
import { room } from "./services.js?v=4.9";
import { state } from "./state.js?v=4.9";

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
export function openDialog(html) {
  document.dispatchEvent(new Event("winnie:surface-change"));
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
