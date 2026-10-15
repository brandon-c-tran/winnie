// Delegated click handling for buttons rendered as HTML strings.
// A button is matched by the first data attribute in BY_ATTRIBUTE it carries, otherwise by
// its data-act name in ACTIONS. Handlers receive the button.
import { sleepContext } from "../everyday.js?v=4.29";
import {
  closeDialog,
  openDialog,
  safe,
  toast,
  requestCloseDialog,
} from "./ui.js?v=4.29";
import { $, active, clock, dayKey, esc } from "./format.js?v=4.29";
import {
  earlierSheet,
  endSleep,
  finishWalk,
  log,
  logCare,
  routineSheet,
  moreCare,
  saveEarlier,
  saveMeal,
} from "./logging.js?v=4.29";
import { editForm, nextCareForm, placePicker, plan } from "./forms.js?v=4.29";
import { confirmVisit, trainerSchedule } from "./trainer.js?v=4.29";
import { showEvidence } from "./library.js?v=4.29";
import { detail } from "./entries.js?v=4.29";
import {
  autoPlace,
  autoPlaceEnabled,
  facts,
  photoURLs,
  room,
  sync,
} from "./services.js?v=4.29";
import { addPhotos, choosePhoto, download } from "./photos.js?v=4.29";
import { review, settings, updatePushStatus } from "./settings.js?v=4.29";
import { openHistory } from "./nav.js?v=4.29";
import { render, roomObject } from "./today.js?v=4.29";
import { state } from "./state.js?v=4.29";
import { QUALITY } from "../pantry.js?v=4.29";
import { postcard, setRecapYear } from "./memories-view.js?v=4.29";

// Disable the button while an async handler runs, so a double tap can't repeat it.
const busy = (fn) => async (b) => {
  b.disabled = true;
  try {
    await fn(b);
  } finally {
    b.disabled = false;
  }
};
// Value attributes match when non-empty; flag attributes (no value) match when present.
const has = (b, key) => !!b.dataset[key];
const flag = (b, name) => b.hasAttribute(name);

const BY_ATTRIBUTE = [
  [
    (b) => has(b, "roomAction"),
    (b) => { closeDialog(); return roomObject(b.dataset.roomAction); },
  ],
  [
    (b) => has(b, "log"),
    (b) => {
      if (state.longPressed) return (state.longPressed = false);
      if ($("dialog").open) closeDialog();
      return log(b.dataset.log);
    },
  ],
  [
    (b) => has(b, "groom"),
    busy((b) => {
      return routineSheet(b.dataset.groom);
    }),
  ],
  [
    (b) => has(b, "also"),
    (b) =>
      b.getAttribute("aria-pressed") === "true"
        ? undefined
        : logCare(b.dataset.also, b.dataset.title, true),
  ],
  [
    (b) => has(b, "earlyType"),
    (b) => earlierSheet({ type: b.dataset.earlyType }),
  ],
  [
    (b) => has(b, "earlyAgo"),
    (b) => earlierSheet({ ago: Number(b.dataset.earlyAgo) }),
  ],
  [(b) => flag(b, "data-early-save"), () => saveEarlier()],
  [
    (b) => flag(b, "data-early-form"),
    () => {
      const time = Date.now() - state.early.ago * 60000;
      if (state.early.type === "grooming")
        return routineSheet("Bath", null, time);
      return editForm(
        state.early.type === "sleep" ? sleepContext().type : state.early.type,
        null,
        { time },
      );
    },
  ],
  [
    (b) => has(b, "food") || flag(b, "data-food-unknown"),
    busy((b) => saveMeal(b.dataset.food || "")),
  ],
  [(b) => has(b, "visit"), (b) => confirmVisit(b.dataset.visit)],
  [
    (b) => has(b, "quality"),
    async (b) => {
      const e = sync.view().events.find((x) => x.id === b.dataset.id);
      if (!e) return;
      const q = b.dataset.quality,
        tags = (e.tags || []).filter((t) => !QUALITY.includes(t));
      await sync.enqueue("edit", e.id, {
        tags: e.tags?.includes(q) ? tags : [...tags, q],
      });
      if ($("dialog").open && state.quickPhotoId === e.id) {
        const selected =
          sync.view().events.find((event) => event.id === e.id)?.tags || [];
        for (const button of $("dialog").querySelectorAll("[data-quality]")) {
          const pressed = selected.includes(button.dataset.quality);
          button.classList.toggle("selected", pressed);
          button.setAttribute("aria-pressed", String(pressed));
        }
      } else if ($("dialog").open) detail(e.id);
    },
  ],
  [
    (b) => has(b, "recapYear"),
    (b) => setRecapYear(Number(b.dataset.recapYear)),
  ],
  [(b) => has(b, "evidence"), (b) => showEvidence(b.dataset.evidence)],
  [
    (b) => flag(b, "data-evidence-more"),
    () => showEvidence(state.evidenceKey, true),
  ],
  [(b) => flag(b, "data-evidence-back"), () => showEvidence(state.evidenceKey)],
  [
    (b) => has(b, "open"),
    (b) => {
      const fromEvidence = !!b.closest(".evidence-list");
      detail(b.dataset.open);
      if (fromEvidence)
        $("dialog-content").insertAdjacentHTML(
          "afterbegin",
          '<button class="text-button" data-evidence-back>Back to the pattern</button>',
        );
    },
  ],
  [(b) => has(b, "place"), (b) => placePicker(b.dataset.place)],
  [(b) => has(b, "edit"), (b) => editForm(null, b.dataset.edit)],
  [(b) => has(b, "newType"), (b) => editForm(b.dataset.newType)],
  [
    (b) => has(b, "end"),
    busy(async (b) => {
      await sync.enqueue("edit", b.dataset.end, { end_time: Date.now() });
      closeDialog();
      room.react("heart");
      toast("Sleep ended");
    }),
  ],
  [(b) => flag(b, "data-form-camera"), () => choosePhoto("form", true)],
  [(b) => flag(b, "data-form-library"), () => choosePhoto("form")],
  [
    (b) => has(b, "photoCamera"),
    (b) => choosePhoto(b.dataset.photoCamera, true),
  ],
  [(b) => has(b, "photoLibrary"), (b) => choosePhoto(b.dataset.photoLibrary)],
  [
    (b) => has(b, "signal"),
    async (b) => {
      await sync.enqueue("edit", b.dataset.id, { signal: b.dataset.signal });
      detail(b.dataset.id);
    },
  ],
  [
    (b) => has(b, "downloadPhoto"),
    async (b) =>
      download(
        await sync.photo(b.dataset.downloadPhoto),
        `winnie-${b.dataset.downloadPhoto}.jpg`,
      ),
  ],
  [
    (b) => has(b, "removePhoto"),
    async (b) => {
      const { id, removePhoto: photoId } = b.dataset;
      await sync.enqueue("removePhoto", id, { photoId });
      detail(id);
      toast("Photo removed", () => sync.enqueue("attach", id, { photoId }));
    },
  ],
  [
    (b) => has(b, "delete"),
    (b) => {
      const id = esc(b.dataset.delete);
      openDialog(
        `<h2 id="dialog-title">Remove this entry?</h2><div class="button-row"><button class="primary" data-confirm-delete="${id}">Remove entry</button><button class="secondary" data-open="${id}">Keep it</button></div><p id="form-error" class="error"></p>`,
      );
    },
  ],
  [
    (b) => has(b, "confirmDelete"),
    async (b) => {
      const id = b.dataset.confirmDelete;
      await sync.enqueue("delete", id);
      closeDialog();
      toast("Entry removed", () => sync.enqueue("restore", id));
    },
  ],
  [
    (b) => has(b, "restore"),
    async (b) => {
      await sync.enqueue("restore", b.dataset.restore);
      detail(b.dataset.restore);
    },
  ],
  [
    (b) => has(b, "resolve"),
    async (b) => {
      await sync.resolve(b.dataset.resolve, b.dataset.mine === "yes");
      review();
    },
  ],
  [
    (b) => has(b, "reviewed"),
    async (b) => {
      await sync.markReviewed(b.dataset.reviewed);
      review();
    },
  ],
  [
    (b) => has(b, "recover"),
    async (b) => {
      const e = sync.data.legacy.events.find((e) => e.id === b.dataset.recover);
      await sync.enqueue("recover", e.id, e);
      await sync.markReviewed(e.id);
      review();
    },
  ],
  [
    (b) => has(b, "revoke"),
    async (b) => {
      await sync.request("revoke", {
        method: "POST",
        value: { deviceId: b.dataset.revoke },
      });
      await sync.refresh();
      settings();
    },
  ],
];

const ACTIONS = {
  settings: () => settings(),
  close: () => requestCloseDialog(),
  more: () => moreCare(),
  review: () => review(),
  plan: () => plan(),
  moment: () => addPhotos(),
  photo: () => addPhotos(),
  earlier: () => earlierSheet(),
  trainer: () => trainerSchedule(),
  "trainer-schedule": () => trainerSchedule(),
  "next-care": () => nextCareForm(),
  "all-history": () => openHistory(),
  "find-poop": () => openHistory({ type: "poop" }),
  "auto-place": () => {
    localStorage.setItem(
      "winnie:auto-place",
      autoPlaceEnabled() ? "off" : "on",
    );
    if (!autoPlaceEnabled()) autoPlace.cancelAll();
    settings();
  },
  "claim-care": async () => {
    const p = sync.view().profile;
    if (p.nextCare)
      await sync.enqueue(
        "profile",
        null,
        { nextCare: { ...p.nextCare, claimedBy: sync.session.person } },
        p.revision,
      );
  },
  "start-walk": async () => {
    closeDialog();
    await log("walk");
  },
  "finish-walk": async () => {
    closeDialog();
    await finishWalk();
  },
  "start-sleep": async () => {
    closeDialog();
    await log("sleep");
  },
  "end-sleep": async () => {
    closeDialog();
    const e = facts().find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e),
    );
    if (e) await endSleep(e);
  },
  "also-done": () => {
    try {
      localStorage.setItem("winnie:also-done", dayKey(Date.now()));
    } catch {}
    render();
  },
  "sync-now": async () => {
    closeDialog();
    await sync.flush();
  },
  "join-code": busy(async () => {
    const { code, expires } = await sync.createJoinCode();
    openDialog(
      `<h2 id="dialog-title">Add a device</h2><p>On the new phone, open Winnie and enter this code.</p><p class="join-code">${esc(code)}</p><p class="fine">Works once, until ${clock(expires)}.</p><button class="px btn" data-act="close">Done</button>`,
    );
  }),
  "trainer-manual": () =>
    editForm("covered_gap", null, {
      who: "trainer",
      time: Date.now() - 3600000,
      end_time: Date.now(),
    }),
  "trainer-import": () => {
    $("trainer-import").value = "";
    $("trainer-import").click();
  },
  "push-check": () => updatePushStatus(),
  "push-off": async (b) => {
    b.disabled = true;
    try {
      await sync.disablePush();
    } finally {
      await updatePushStatus();
    }
  },
  push: async (b) => {
    b.disabled = true;
    try {
      await sync.enablePush();
    } finally {
      await updatePushStatus();
    }
  },
  "postcard-share": () => postcard(true),
  "postcard-save": () => postcard(false),
  export: () => {
    const { home, token, person, ...shared } = sync.data.snapshot;
    download(
      {
        exportedAt: new Date().toISOString(),
        shared,
        pending: sync.data.queue.map(({ command, error, queuedAt }) => ({
          command,
          error,
          queuedAt,
        })),
        olderPhoneCopy: sync.data.legacy,
      },
      `winnie-history-${dayKey(Date.now())}.json`,
    );
  },
  invite: () =>
    openDialog(
      `<h2 id="dialog-title">Shared code</h2><input readonly aria-label="Shared code" value="${esc(sync.session.code)}"><p class="fine">Anyone with this code can join the log.</p>`,
    ),
  reconnect: () => {
    if (sync.data.queue.length)
      throw new Error(
        "Finish syncing or reviewing this phone's changes before switching person.",
      );
    localStorage.removeItem("winnie:v4:session");
    sync.session = null;
    for (const url of photoURLs.values()) URL.revokeObjectURL(url);
    photoURLs.clear();
    closeDialog();
    render();
  },
};

document.addEventListener(
  "click",
  safe(async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    const match = BY_ATTRIBUTE.find(([matches]) => matches(b));
    if (match) return match[1](b);
    return ACTIONS[b.dataset.act]?.(b);
  }),
);
