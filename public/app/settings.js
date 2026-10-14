// Settings, sync status, review of conflicting or older changes, and joining.
import { placeLabel } from "../places.js?v=4.25";
import { autoPlaceEnabled, sync } from "./services.js?v=4.25";
import { $, clock, dateLabel, esc, person, when } from "./format.js?v=4.25";
import { openDialog, safe } from "./ui.js?v=4.25";
import { eventLabel } from "./entries.js?v=4.25";
import { render } from "./today.js?v=4.25";

function syncSheet() {
  const pending = sync.data.queue.length,
    errors = sync.data.queue.filter((q) => q.error).length;
  const [title, msg] = sync.lastError
    ? [
        navigator.onLine ? "Sync needs attention" : "Offline",
        `This phone can't reach the shared log: ${sync.lastError} New logs keep saving here and send when it's back.`,
      ]
    : errors
      ? [
          "Needs review",
          `${errors} ${errors === 1 ? "change conflicts" : "changes conflict"} with an edit from the other phone. Pick which version to keep. Nothing is lost until you choose.`,
        ]
      : pending
        ? [
            "Not sent yet",
            `${pending} ${pending === 1 ? "change is" : "changes are"} saved on this phone and not in the shared log yet.`,
          ]
        : [
            "Up to date",
            `Everything on this phone is in the shared log. Checked ${sync.lastChecked ? when(sync.lastChecked) : "just now"}.`,
          ];
  openDialog(
    `<h2 id="dialog-title">${title}</h2><p>${esc(msg)}</p><div class="button-row"><button class="px btn ink" data-act="sync-now">Check now</button>${errors ? '<button class="px btn" data-act="review">Review changes</button>' : ""}</div>`,
  );
}
export function settings() {
  if (!sync.session) {
    $("shared-code").focus();
    return;
  }
  const devices = sync.data.snapshot.devices || [],
    me = sync.session.token.split(".")[0],
    entries = sync.data.snapshot.events.filter((e) => !e.deletedAt).length;
  openDialog(
    `<h2 id="dialog-title">Settings</h2><div class="setting-block"><h3>${person(sync.session.person)}</h3><button class="px btn" id="push-toggle" data-act="push" disabled>Checking notifications</button><p id="push-status" class="fine" role="status"></p></div><div class="setting-block"><h3>Location</h3><button class="px btn" data-act="auto-place">Automatic location: ${autoPlaceEnabled() ? "on" : "off"}</button><p class="fine">Nothing is tracked between logs.</p></div><div class="setting-block"><h3>Plans</h3><div class="button-row"><button class="px btn" data-act="plan">Shared plan</button><button class="px btn" data-act="trainer-schedule">Trainer visits</button></div></div><div class="setting-block"><h3>History</h3><p>${entries.toLocaleString()} entries. Old entries keep who logged them.</p><p class="fine">Logged in the app: Brandon ${sync.data.snapshot.usage?.brandon || 0}, Kim ${sync.data.snapshot.usage?.kim || 0}</p><div class="button-row"><button class="px btn" data-act="export">Export history</button><button class="text-button" data-act="review">Review changes</button></div></div><div class="setting-block"><h3>Devices</h3>${devices
      .filter((d) => !d.revoked)
      .map(
        (d) =>
          `<div class="device"><span>${esc(d.name)} · ${person(d.person)}${d.id === me ? " · this phone" : ""}</span>${d.id !== me ? `<button class="text-button danger" data-revoke="${esc(d.id)}">Remove</button>` : ""}</div>`,
      )
      .join(
        "",
      )}<div class="button-row"><button class="px btn ink" data-act="join-code">Add a device</button>${sync.session.code ? '<button class="text-button" data-act="invite">Show shared code</button>' : ""}</div></div><div class="setting-block"><button class="text-button" data-act="reconnect">Switch person on this phone</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  updatePushStatus();
}
export async function updatePushStatus() {
  const button = $("push-toggle");
  if (!button) return;
  try {
    const state = await sync.pushState();
    if ($("push-toggle") !== button) return;
    const labels = {
      on: "Turn off notifications",
      off: "Turn on notifications",
      repair: "Reconnect notifications",
      blocked: "Notifications blocked in iPhone Settings",
      unsupported: "Open from the Home Screen to turn on",
    };
    button.textContent = labels[state];
    button.dataset.act = state === "on" ? "push-off" : "push";
    button.disabled = ["blocked", "unsupported"].includes(state);
    $("push-status").textContent =
      state === "on"
        ? "On. You get one when the other person logs something."
        : state === "repair"
          ? "Notifications need to reconnect on this phone."
          : state === "blocked"
            ? "Allow notifications for Winnie in iPhone Settings, then reopen Settings here."
            : state === "unsupported"
              ? "On iPhone, add Winnie to the Home Screen from Safari and open it there."
              : "Get a notification when the other person logs something.";
  } catch {
    if ($("push-toggle") === button) {
      button.textContent = "Retry notification check";
      button.dataset.act = "push-check";
      button.disabled = false;
      $("push-status").textContent =
        "Could not check this phone’s notification setup.";
    }
  }
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}
export function legacyDiff() {
  const d = sync.data;
  if (!d.legacy) return [];
  const reviewed = new Set(d.reviewed),
    byId = new Map(d.snapshot.events.map((e) => [e.id, e]));
  return d.legacy.events.filter((e) => {
    if (reviewed.has(e.id)) return false;
    const shared = byId.get(e.id);
    return (
      !shared ||
      shared.deletedAt ||
      Object.keys(e).some(
        (k) =>
          JSON.stringify(canonical(e[k])) !==
          JSON.stringify(canonical(shared[k])),
      )
    );
  });
}
function compareEntry(e) {
  if (!e) return "No shared entry";
  return [
    e.type ? eventLabel(e) : "Saved changes",
    e.time ? dateLabel(e.time) + " at " + clock(e.time) : "",
    e.end_time
      ? "Ended " + dateLabel(e.end_time) + " at " + clock(e.end_time)
      : "",
    e.note ? "Note: " + e.note : "",
    placeLabel(e) ? "Place: " + placeLabel(e) : "",
    e.tags?.length ? "Tags: " + e.tags.join(", ") : "",
    e.signal ? "Signal: " + e.signal : "",
    e.deletedAt ? "This entry was removed." : "",
    e.routine ? "Routine: " + e.routine : "",
    e.goal ? "Practicing: " + e.goal : "",
    e.photos?.length ? e.photos.length + " photos" : "",
  ]
    .filter(Boolean)
    .join("\n");
}
export function review() {
  const conflicts = sync.data.queue.filter((q) => q.error),
    older = legacyDiff();
  openDialog(
    `<h2 id="dialog-title">Review changes</h2><p class="fine">Nothing is deleted until you choose.</p>${conflicts.map((q) => `<div class="recovery"><h3>${esc(q.error)}</h3><p class="fine">${esc(q.command.kind)} · ${esc(q.command.payload.note || q.command.payload.type || q.command.eventId)}</p><details><summary>Compare saved changes</summary><p class="fine">Your pending change</p><pre>${esc(compareEntry(q.command.payload))}</pre><p class="fine">Latest shared entry</p><pre>${esc(compareEntry(q.current))}</pre></details><div class="button-row">${!["create", "recover"].includes(q.command.kind) && q.current && !q.current.deletedAt ? `<button class="secondary small" data-resolve="${q.command.operationId}" data-mine="yes">Use my changes</button>` : ""}<button class="text-button" data-resolve="${q.command.operationId}">Keep shared version</button></div></div>`).join("")}${older
      .slice(0, 25)
      .map((e) => {
        const shared = sync.data.snapshot.events.find((x) => x.id === e.id);
        return `<div class="recovery"><h3>${esc(eventLabel(e))} · ${dateLabel(e.time)}</h3><p class="fine">${shared ? "Different from the shared entry" : "Only in this phone’s older copy"} · ${clock(e.time)}</p><details><summary>Compare both versions</summary><p class="fine">Phone copy</p><pre>${esc(compareEntry(e))}</pre><p class="fine">Shared copy</p><pre>${esc(compareEntry(shared))}</pre></details><div class="button-row">${!shared ? `<button class="secondary small" data-recover="${esc(e.id)}">Keep this entry</button>` : !shared.deletedAt ? `<button class="secondary small" data-edit="${esc(e.id)}">Edit shared entry</button>` : `<button class="secondary small" data-restore="${esc(e.id)}">Restore shared entry</button>`}<button class="text-button" data-reviewed="${esc(e.id)}">Keep shared history</button></div></div>`;
      })
      .join(
        "",
      )}${!conflicts.length && !older.length ? '<div class="empty"><h3>Nothing to review.</h3></div>' : ""}${older.length > 25 ? '' : ""}<p id="form-error" class="error" role="alert"></p>`,
  );
}
$("sync-chip").onclick = () => syncSheet();
$("settings").onclick = settings;
$("connect-form").onsubmit = safe(async (e) => {
  e.preventDefault();
  $("connect-error").textContent = "";
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const code = $("shared-code").value.trim(),
      who = new FormData(e.target).get("person"),
      name = $("device-name").value.trim();
    if (/^[A-Za-z0-9]{4}[-\s]?[A-Za-z0-9]{4}$/.test(code))
      await sync.join(code, who, name);
    else await sync.pair(code, who, name);
    render();
  } catch (err) {
    $("connect-error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
