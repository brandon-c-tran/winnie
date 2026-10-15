import {
  PHOTO_CONCEPTS,
  photoMatches,
  suggestedPairs,
  suggestedCollections,
  pairKey,
} from "../photo-discovery.js?v=4.28";
import { selectedPhotos, ageAt } from "../lifetime.js?v=4.28";
import { $, esc, uid } from "./format.js?v=4.28";
import { facts, sync } from "./services.js?v=4.28";
import { html, openDialog, closeDialog, safe, toast } from "./ui.js?v=4.28";
import { hydratePhotos } from "./entries.js?v=4.28";
import { renderStory } from "./library.js?v=4.28";

const library = () =>
  sync.view().profile.memoryLibrary || { collections: [], pairs: {} };
const observations = () => sync.view().photoAI?.results || {};
const photoDate = (p) =>
  new Date(p.day + "T12:00Z").toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const photo = (p) =>
  `<button class="discovery-photo" data-open="${esc(p.event.id)}" aria-label="Open photo from ${esc(p.day)}"><img data-photo="${esc(p.photo.id)}" alt="${esc(p.event.note || observations()[p.photo.id]?.description || "Photo of Winnie")}" loading="lazy"><span><strong>${photoDate(p)}</strong><small>${ageAt(p.day)}</small></span></button>`;
let savedLimit = 12;
let activeCollection = "",
  runner = false;
export const collectionPhotoIds = () =>
  activeCollection
    ? new Set(
        library().collections.find((c) => c.id === activeCollection)
          ?.photoIds || [],
      )
    : null;
export const discoveryMatch = (e, p, query) =>
  photoMatches(
    query,
    [
      e.note,
      e.location,
      p.metadata?.location,
      p.metadata?.wall,
      e.time ? new Date(e.time).toLocaleDateString() : "",
      ...(e.tags || []),
    ].join(" "),
    observations()[p.id],
  );
export function renderPhotoDiscovery(show) {
  const box = $("photo-discovery");
  box.hidden = !show;
  if (!show) return;
  const all = selectedPhotos(facts()),
    ai = sync.view().photoAI || {},
    lib = library();
  if (
    activeCollection &&
    !lib.collections.some((c) => c.id === activeCollection)
  )
    activeCollection = "";
  const pairs = suggestedPairs(all, observations(), lib.pairs, 1),
    pair = pairs[0];
  const saved = Object.entries(lib.pairs)
    .filter(([, s]) => s === "kept")
    .map(([key]) =>
      key.split("~").map((id) => all.find((p) => p.photo.id === id)),
    )
    .filter((ps) => ps.every(Boolean))
    .map((ps) => ps.sort((a, b) => a.day.localeCompare(b.day)));
  const suggestions = suggestedCollections(all, observations())
    .filter(
      (c) =>
        !lib.collections.some(
          (s) => s.name.toLowerCase() === c.concept.toLowerCase(),
        ),
    )
    .slice(0, 4);
  html(
    "photo-discovery",
    `<div class="discovery-heading"><h2>Rediscover Winnie</h2><button class="text-button" data-discovery-settings>${Object.keys(observations()).length ? "Review photo labels" : "Photo discovery setup"}</button></div>
    ${!Object.keys(observations()).length ? '<p class="fine discovery-intro">Photo search and comparisons start with a five-photo sample.</p>' : ""}
    ${ai.pending ? `<p class="fine" role="status">${ai.pending} photos waiting to be described. You can keep browsing.</p>` : ""}
    ${ai.lastError ? `<p class="error">${esc(ai.lastError)} <button class="text-button" data-discovery-settings>Review scan</button></p>` : ""}
    ${pair ? `<section class="discovery-pair" aria-label="Suggested Then and Now"><div class="discovery-pair-title"><h3>Then & now</h3><span>${pair.gap} days apart</span></div><div class="discovery-spread">${photo(pair.first)}${photo(pair.last)}</div><div class="discovery-pair-footer"><p>Both may show <strong>${esc(pair.concept)}</strong>.</p><div class="button-row"><button class="primary" data-keep-pair="${esc(pair.id)}">Keep pair</button><button class="text-button" data-dismiss-pair="${esc(pair.id)}">Wrong match</button></div></div></section>` : ""}
    ${
      saved.length
        ? `<details class="discovery-saved"><summary>Saved comparisons (${saved.length})</summary>${saved
            .slice(0, savedLimit)
            .map(
              (ps) =>
                `<div class="discovery-spread">${ps.map(photo).join("")}</div><button class="text-button" data-dismiss-pair="${esc(pairKey(ps[0].photo.id, ps[1].photo.id))}">Remove comparison</button>`,
            )
            .join(
              "",
            )}${saved.length > savedLimit ? '<button class="text-button" data-more-comparisons>Show more comparisons</button>' : ""}</details>`
        : ""
    }
    <div class="discovery-collections"><div class="discovery-heading"><h3>Your collections</h3><button class="text-button" data-new-collection>Create collection</button></div>
    ${lib.collections.length ? `<div class="collection-links"><button class="text-button" data-filter-collection="" aria-pressed="${!activeCollection}">All Winnie photos</button>${lib.collections.map((c) => `<button class="text-button" data-filter-collection="${esc(c.id)}" aria-pressed="${c.id === activeCollection}">${esc(c.name)} <span>(${c.photoIds.filter((id) => all.some((p) => p.photo.id === id)).length})</span></button>`).join("")}</div>` : '<p class="fine">No collections yet.</p>'}
    ${activeCollection ? `<button class="text-button" data-edit-collection="${esc(activeCollection)}">Edit this collection</button>` : ""}
    ${suggestions.length ? `<details><summary>Suggested collections</summary><p class="fine">Based on photo labels. Review the selection before saving.</p><div class="collection-links">${suggestions.map((c) => `<button class="secondary" data-suggest-collection="${esc(c.concept)}">${esc(c.concept)} <span>(${c.photoIds.length})</span></button>`).join("")}</div></details>` : ""}</div>`,
  );
  if (ai.enabled && (ai.pending || ai.auto)) void runQueue();
}
async function saveLibrary(next) {
  const ids = new Set(selectedPhotos(facts()).map((p) => p.photo.id));
  next.collections = next.collections.map((c) => ({
    ...c,
    photoIds: c.photoIds.filter((id) => ids.has(id)),
  }));
  next.pairs = Object.fromEntries(
    Object.entries(next.pairs).filter(([key]) =>
      key.split("~").every((id) => ids.has(id)),
    ),
  );
  await sync.enqueue("profile", null, { memoryLibrary: next });
  renderStory();
}
function collectionEditor(existing = null, suggested = null) {
  const all = selectedPhotos(facts()),
    chosen = new Set(existing?.photoIds || suggested?.photoIds || []);
  let page = 0;
  openDialog(
    `<h2 id="dialog-title" class="discovery-sheet-title">${existing ? "Edit collection" : "Create collection"}</h2><form id="collection-editor"><label>Name<input name="name" required maxlength="80" value="${esc(existing?.name || suggested?.concept || "")}" placeholder="e.g. His pink bed"></label><label>Find photos<input id="collection-search" type="search" placeholder="Date, place or photo labels"></label><p id="collection-selected" class="fine" role="status"></p><div id="collection-choices" class="collection-choices"></div><div class="memory-picker-pages"><button type="button" class="secondary" id="collection-prev">Previous</button><span id="collection-page"></span><button type="button" class="secondary" id="collection-next">Next</button></div><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save collection</button>${existing ? '<button type="button" class="text-button" id="delete-collection">Delete collection</button>' : ""}</div></form>`,
  );
  const show = () => {
    const matches = all.filter((p) =>
        discoveryMatch(p.event, p.photo, $("collection-search").value),
      ),
      pages = Math.max(1, Math.ceil(matches.length / 24));
    page = Math.min(page, pages - 1);
    $("collection-choices").innerHTML =
      matches
        .slice(page * 24, page * 24 + 24)
        .map(
          (p) =>
            `<label class="collection-choice"><input type="checkbox" value="${esc(p.photo.id)}" ${chosen.has(p.photo.id) ? "checked" : ""}><img data-photo="${esc(p.photo.id)}" alt="${esc(p.event.note || observations()[p.photo.id]?.description || "Photo of Winnie")}" loading="lazy"><span>${photoDate(p)}</span></label>`,
        )
        .join("") || "<p>No matching photos.</p>";
    $("collection-selected").textContent =
      `${chosen.size} selected out of ${all.length} photos`;
    $("collection-page").textContent = `${page + 1} / ${pages}`;
    $("collection-prev").disabled = !page;
    $("collection-next").disabled = page === pages - 1;
    hydratePhotos();
  };
  $("collection-search").oninput = () => {
    page = 0;
    show();
  };
  $("collection-prev").onclick = () => {
    page--;
    show();
  };
  $("collection-next").onclick = () => {
    page++;
    show();
  };
  $("collection-choices").onchange = (e) => {
    if (e.target.checked) chosen.add(e.target.value);
    else chosen.delete(e.target.value);
    $("collection-selected").textContent =
      `${chosen.size} selected out of ${all.length} photos`;
  };
  $("collection-editor").onsubmit = safe(async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) throw Error("Give this collection a name.");
    const lib = structuredClone(library()),
      value = { id: existing?.id || uid(), name, photoIds: [...chosen] };
    lib.collections = lib.collections
      .filter((c) => c.id !== value.id)
      .concat(value);
    await saveLibrary(lib);
    activeCollection = value.id;
    closeDialog();
    renderStory();
    toast("Collection saved on this device");
  });
  if (existing)
    $("delete-collection").onclick = safe(async () => {
      const lib = structuredClone(library());
      lib.collections = lib.collections.filter((c) => c.id !== existing.id);
      await saveLibrary(lib);
      closeDialog();
      renderStory();
      toast("Collection removed; photos kept");
    });
  show();
}
async function runQueue() {
  if (runner || !navigator.onLine) return;
  runner = true;
  try {
    // One job at a time, only while visible. The scheduled worker continues when closed.
    for (let n = 0; n < 25 && !document.hidden; n++) {
      const before = await sync.request("photo-ai");
      if (
        !before.enabled ||
        (!before.pending && !before.auto) ||
        !before.configured ||
        before.usage.calls >= 50
      )
        break;
      const after = await sync.request("photo-ai", {
        method: "POST",
        value: { action: "run" },
      });
      await sync.refresh();
      renderStory();
      if ($("scan-progress"))
        $("scan-progress").textContent =
          `${Object.keys(after.results).length} photos described. ${after.pending} waiting. Refresh results below to review new descriptions.`;
      if (after.pending >= before.pending) break;
    }
  } catch {
    /* Persisted jobs survive connectivity loss; the setup panel reports status. */
  } finally {
    runner = false;
  }
}
async function settings() {
  openDialog(
    '<h2 id="dialog-title" class="discovery-sheet-title">Photo discovery</h2><p role="status">Checking photo scans…</p><p id="form-error" class="error" role="alert"></p>',
  );
  const info = await sync.request("photo-ai");
  if (!$("dialog").open || $("dialog-title")?.textContent !== "Photo discovery")
    return;
  const entries = Object.entries(info.results),
    all = selectedPhotos(facts());
  let page = 0;
  openDialog(`<h2 id="dialog-title" class="discovery-sheet-title">Photo discovery</h2>
    <p class="fine">Scanning sends saved photos to OpenAI. Descriptions can be wrong; you can edit every label. Captions, dates and places stay unchanged. No face identification or health interpretation.</p>
    ${!info.configured ? '<p class="error">Scanning is not connected yet. Collections and caption search are available.</p>' : ""}
    ${info.enabled || entries.length ? `<div class="scan-status"><strong id="scan-progress" role="status">${entries.length} photos described. ${info.pending} waiting${info.failed ? `, ${info.failed} need retry` : ""}.</strong><button class="text-button" type="button" data-discovery-settings>Refresh scan results</button></div>` : ""}
    ${info.lastError ? `<p class="error">${esc(info.lastError)}</p>` : ""}
    <form id="scan-controls">${
      !info.enabled
        ? `<label class="check"><input type="checkbox" name="consent" required>Send selected memory photos to OpenAI for description</label><label class="check"><input type="checkbox" name="care">Also include care photos I’ve explicitly kept for Winnie’s story</label><button class="primary" ${!info.configured ? "disabled" : ""}>Try five photos</button>`
        : `${entries.length ? '<label class="check"><input type="checkbox" name="reviewed" required>I’ve checked the descriptions below</label>' : ""}<div class="button-row"><button class="primary" ${!entries.length || info.pending || info.failed || !info.configured ? "disabled" : ""}>Scan next 25</button>${info.failed ? '<button type="button" class="secondary" data-scan="retry">Retry failed photos</button>' : ""}<button type="button" class="text-button" data-scan="disable">Pause scanning</button></div>${entries.length ? `<button type="button" class="text-button" data-scan="auto">${info.auto ? "Turn off automatic scans" : "Scan new photos after upload"}</button>` : ""}`
    }</form>
    <details class="scan-usage"><summary>Scan limits & usage</summary><p class="fine">Up to 50 attempts per household each day. Saved jobs continue every five minutes when the app is closed. Pausing stops future requests; a photo already being processed cannot be recalled.</p><p class="fine">${info.usage.calls} / 50 attempts today (UTC). ${info.usage.inputTokens.toLocaleString()} input tokens and ${info.usage.outputTokens.toLocaleString()} output tokens. Usage resets at midnight UTC; billing is in your OpenAI account.</p></details>
    ${entries.length ? '<h3>Check what the scan saw</h3><p class="fine">Edit any mistaken description or label.</p><div id="scan-results"></div><div class="memory-picker-pages"><button class="secondary" id="scan-prev">Previous</button><span id="scan-page"></span><button class="secondary" id="scan-next">Next</button></div><details><summary>Remove descriptions</summary><p>Removes the scan index and stops scanning. Your photos, captions and saved collections stay.</p><button class="text-button" data-scan="forget">Remove all descriptions</button></details>' : ""}<p id="form-error" class="error" role="alert"></p>`);
  const show = () => {
    if (!$("scan-results")) return;
    const pages = Math.ceil(entries.length / 8);
    $("scan-results").innerHTML = entries
      .slice(page * 8, page * 8 + 8)
      .map(
        ([id, r]) =>
          `<article class="scan-result"><img data-photo="${esc(id)}" alt="" loading="lazy"><div><p>${esc(r.description || "No description")}</p><span class="fine">${r.source === "user" ? "Edited by you" : "AI suggestion"}${all.find((p) => p.photo.id === id) ? '</span><span class="scan-result-date fine">' + photoDate(all.find((p) => p.photo.id === id)) : ""}</span><button class="text-button" data-correct-photo="${esc(id)}">Edit description & labels</button></div></article>`,
      )
      .join("");
    $("scan-page").textContent = `${page + 1} / ${pages}`;
    $("scan-prev").disabled = !page;
    $("scan-next").disabled = page >= pages - 1;
    hydratePhotos();
  };
  if (entries.length) {
    $("scan-prev").onclick = () => {
      page--;
      show();
    };
    $("scan-next").onclick = () => {
      page++;
      show();
    };
    show();
  }
  const action = async (value) => {
    await sync.request("photo-ai", { method: "POST", value });
    await sync.refresh();
    renderStory();
    await settings();
    void runQueue();
  };
  $("scan-controls").onsubmit = safe(async (e) => {
    e.preventDefault();
    const form = e.target;
    await action(
      info.enabled
        ? { action: "more", reviewed: form.elements.reviewed?.checked }
        : {
            action: "sample",
            consent: form.elements.consent.checked,
            includeCare: form.elements.care.checked,
          },
    );
  });
  $("dialog")
    .querySelectorAll("[data-scan]")
    .forEach(
      (b) =>
        (b.onclick = safe(async () => {
          if (
            b.dataset.scan === "auto" &&
            !info.auto &&
            !$("scan-controls").elements.reviewed?.checked
          )
            throw Error(
              "Check the sample descriptions, then select the review checkbox.",
            );
          b.disabled = true;
          try {
            await action({
              action: b.dataset.scan,
              reviewed: true,
              enabled: !info.auto,
            });
          } finally {
            b.disabled = false;
          }
        })),
    );
}
function correctPhoto(id) {
  const r = observations()[id];
  if (!r) return;
  openDialog(
    `<h2 id="dialog-title" class="discovery-sheet-title">What’s in this photo?</h2><img class="observation-preview" data-photo="${esc(id)}" alt="Photo being described"><form id="observation-form"><label>Description<textarea name="description" maxlength="400">${esc(r.description)}</textarea></label><fieldset><legend>Visible details</legend><div class="concept-choices">${PHOTO_CONCEPTS.map((c) => `<label class="check"><input type="checkbox" name="concept" value="${esc(c)}" ${r.concepts.includes(c) ? "checked" : ""}>${esc(c)}</label>`).join("")}</div></fieldset><p class="fine">These labels help search and suggestions. Your original caption stays unchanged.</p><p id="form-error" class="error" role="alert"></p><button class="primary">Save description</button></form>`,
  );
  hydratePhotos();
  $("observation-form").onsubmit = safe(async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    await sync.request("photo-ai", {
      method: "POST",
      value: {
        action: "correct",
        photoId: id,
        observation: {
          description: d.get("description"),
          concepts: d.getAll("concept"),
        },
      },
    });
    await sync.refresh();
    renderStory();
    await settings();
  });
}
document.addEventListener(
  "click",
  safe(async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-more-comparisons")) {
      savedLimit += 12;
      renderStory();
      const saved = $("photo-discovery").querySelector(".discovery-saved");
      if (saved) saved.open = true;
      hydratePhotos();
    }
    if (b.hasAttribute("data-discovery-settings")) await settings();
    if (b.hasAttribute("data-new-collection")) collectionEditor();
    if (b.dataset.editCollection)
      collectionEditor(
        library().collections.find((c) => c.id === b.dataset.editCollection),
      );
    if (b.dataset.suggestCollection)
      collectionEditor(
        null,
        suggestedCollections(selectedPhotos(facts()), observations()).find(
          (c) => c.concept === b.dataset.suggestCollection,
        ),
      );
    if (b.hasAttribute("data-filter-collection")) {
      activeCollection = b.dataset.filterCollection;
      renderStory();
    }
    if (b.dataset.keepPair || b.dataset.dismissPair) {
      const lib = structuredClone(library());
      lib.pairs[b.dataset.keepPair || b.dataset.dismissPair] = b.dataset
        .keepPair
        ? "kept"
        : "dismissed";
      await saveLibrary(lib);
      toast(
        b.dataset.keepPair
          ? "Comparison kept"
          : "Pair removed from suggestions",
      );
    }
    if (b.dataset.correctPhoto) correctPhoto(b.dataset.correctPhoto);
  }),
);
