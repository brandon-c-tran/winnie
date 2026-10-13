// Photo picking, resizing, and saving.
import { $ } from "./format.js?v=4.6";
import { closeDialog, safe, toast } from "./ui.js?v=4.6";
import { sync } from "./services.js?v=4.6";
import { detail } from "./entries.js?v=4.6";
import { render } from "./today.js?v=4.6";
import { state } from "./state.js?v=4.6";

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
for (const id of ["camera-input", "library-input"])
  $(id).onchange = safe(async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 20),
      target = state.photoTarget;
    if (!files.length) return;
    toast("Preparing photo");
    for (const file of files) {
      const blob = await photoFile(file);
      if (target === "form") {
        if (!$("event-form")) return;
        state.formPhotos.push(blob);
        $("form-photo-status").textContent =
          `${state.formPhotos.length} ${state.formPhotos.length === 1 ? "photo" : "photos"} ready to keep.`;
      } else await sync.addPhoto(target, blob);
    }
    if (target !== "form") {
      toast(`${files.length === 1 ? "Photo" : "Photos"} saved on this device.`);
      if (state.quickPhotoId === target) {
        state.quickPhotoId = null;
        closeDialog();
      } else if ($("dialog").open && state.detailId === target) detail(target);
      render();
    } else toast("Photo attached. Save to keep it.");
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
