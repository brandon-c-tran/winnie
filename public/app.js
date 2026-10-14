// Winnie: startup. Everything else lives in ./app/.
import { protectAppSelection } from "./selection.js?v=4.24";
import { sync } from "./app/services.js?v=4.24";
import { render } from "./app/today.js?v=4.24";
import { detail, refreshReactions } from "./app/entries.js?v=4.24";
import { $ } from "./app/format.js?v=4.24";
import { setTab } from "./app/nav.js?v=4.24";
import { error, hasDialogDrafts, restoreDrafts } from "./app/ui.js?v=4.24";
import "./app/format.js?v=4.24";
import "./app/services.js?v=4.24";
import "./app/ui.js?v=4.24";
import "./app/nav.js?v=4.24";
import "./app/today.js?v=4.24";
import "./app/library.js?v=4.24";
import "./app/entries.js?v=4.24";
import "./app/logging.js?v=4.24";
import "./app/forms.js?v=4.24";
import "./app/settings.js?v=4.24";
import "./app/photos.js?v=4.24";
import "./app/clicks.js?v=4.24";
import "./app/trainer.js?v=4.24";

if (["localhost", "127.0.0.1"].includes(location.hostname))
  document.querySelectorAll('img[src^="/.netlify/images"]').forEach((img) => {
    img.src = new URL(img.src).searchParams.get("url");
  });
protectAppSelection();
sync.addEventListener("change", () => {
  render();
  refreshReactions();
});
const hadController = !!navigator.serviceWorker?.controller;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((r) => r.update())
    .catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => {
    // A first install also announces itself; only a real update (an older
    // version was already running this page) needs a reload.
    if (e.data?.type === "APP_UPDATED" && hadController) {
      const reload = () => {
        if (
          !$("dialog").open && !hasDialogDrafts() &&
          !document.querySelector("input:focus, textarea:focus")
        )
          location.reload();
      };
      reload();
      document.addEventListener(
        "visibilitychange",
        () => !document.hidden && reload(),
      );
      return;
    }
    if (e.data?.type === "OPEN_EVENT") {
      setTab("today");
      sync
        .refresh()
        .then(() => detail(e.data.id))
        .catch(error);
    }
  });
}
await sync.init().catch((err) => {
  $("connect").hidden = false;
  $("connect-error").textContent =
    "Winnie couldn’t open safe storage on this device. Please allow browser storage, then reload. " +
    err.message;
  $("connect-form").querySelector("[type=submit]").disabled = true;
});
const linkedEvent = new URL(location.href).searchParams.get("event");
await restoreDrafts();
if (linkedEvent && sync.session) {
  await sync.refresh().catch(() => {});
  detail(linkedEvent);
}
setInterval(() => {
  if (!document.hidden && !$("dialog").open) render();
}, 60000);
