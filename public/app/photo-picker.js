import { filterPhotoChoices } from "../story-album.js?v=4.28";
import { $, esc } from "./format.js?v=4.28";
import { openDialog, safe } from "./ui.js?v=4.28";
import { hydratePhotos } from "./entries.js?v=4.28";

// A bounded window over the complete library. No photo becomes unreachable as it grows.
export function pickMemoryPhoto({
  title = "Choose a photo",
  photos,
  onChoose,
}) {
  let page = 0;
  const months = [...new Set(photos.map((p) => p.day.slice(0, 7)))]
    .sort()
    .reverse();
  openDialog(
    `<h2 id="dialog-title">${esc(title)}</h2><div class="memory-picker-tools"><label>Month<select id="memory-picker-month"><option value="">All months</option>${months.map((m) => `<option value="${m}">${new Date(m + "-15T12:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>`).join("")}</select></label><label>Find a photo<input id="memory-picker-search" type="search" placeholder="Date, place or remembered words"></label></div><p id="memory-picker-count" class="fine" role="status"></p><div id="memory-picker-grid" class="memory-picker-grid"></div><div class="memory-picker-pages"><button class="secondary" id="memory-picker-prev">Previous</button><span id="memory-picker-page"></span><button class="secondary" id="memory-picker-next">Next</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  const show = () => {
    const items = filterPhotoChoices(photos, {
      month: $("memory-picker-month").value,
      query: $("memory-picker-search").value,
    });
    const pages = Math.max(1, Math.ceil(items.length / 24));
    page = Math.min(page, pages - 1);
    $("memory-picker-count").textContent = items.length
      ? `${items.length.toLocaleString()} ${items.length === 1 ? "photo" : "photos"}`
      : "No photos match. Try another month or search.";
    $("memory-picker-grid").innerHTML = items
      .slice(page * 24, page * 24 + 24)
      .map(
        (p) =>
          `<button data-memory-choice="${esc(p.photo.id)}" aria-label="Choose photo from ${esc(p.day)}${p.location ? ", " + esc(p.location) : ""}"><img data-photo="${esc(p.photo.id)}" alt="" loading="lazy"><span>${esc(p.day)}</span>${p.location ? `<small>${esc(p.location)}</small>` : ""}</button>`,
      )
      .join("");
    $("memory-picker-prev").disabled = page === 0;
    $("memory-picker-next").disabled = page >= pages - 1;
    $("memory-picker-page").textContent = `${page + 1} / ${pages}`;
    $("memory-picker-grid").onclick = safe(async (e) => {
      const button = e.target.closest("[data-memory-choice]");
      if (!button) return;
      button.disabled = true;
      try {
        await onChoose(
          items.find((p) => p.photo.id === button.dataset.memoryChoice),
        );
      } finally {
        button.disabled = false;
      }
    });
    hydratePhotos();
  };
  for (const id of ["memory-picker-month", "memory-picker-search"])
    $(id).oninput = () => {
      page = 0;
      show();
    };
  $("memory-picker-prev").onclick = () => {
    page--;
    show();
  };
  $("memory-picker-next").onclick = () => {
    page++;
    show();
  };
  show();
}
