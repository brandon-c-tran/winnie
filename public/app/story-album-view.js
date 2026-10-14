import { albumChapters, ageMonth } from "../story-album.js?v=4.27";
import { ageAt, recordDay, selectedPhotos } from "../lifetime.js?v=4.27";
import { facts, sync } from "./services.js?v=4.27";
import { $, esc } from "./format.js?v=4.27";
import { closeDialog, safe, toast } from "./ui.js?v=4.27";
import { pickMemoryPhoto } from "./photo-picker.js?v=4.27";
import { recollectionsHTML } from "./recollections.js?v=4.27";
import { detail } from "./entries.js?v=4.27";
import { download, addPhotos } from "./photos.js?v=4.27";

let year = 0,
  chapterMonth = null;
const changed = () => document.dispatchEvent(new Event("winnie:story-change"));
const chapterData = () => albumChapters(facts(), sync.view().profile, year);
const image = (p, cls = "") =>
  `<img class="${cls}" data-photo="${esc(p.photo.id)}" alt="Winnie at ${esc(ageAt(p.day))}" loading="lazy">`;
const dayLabel = (day) =>
  new Date(day + "T12:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export function storyAlbumHTML() {
  const chapters = chapterData(),
    maxYear = Math.max(
      0,
      Math.floor(ageMonth(recordDay({ time: Date.now() })) / 12),
    );
  if (!chapters.some((c) => c.month === chapterMonth))
    chapterMonth = (
      chapters.find((c) => c.month === 2 && c.photos.length) ||
      chapters.find((c) => c.photos.length) ||
      chapters[0]
    )?.month;
  const current = chapters.find((c) => c.month === chapterMonth);
  if (!current) return "";
  const p = current.cover;
  const all = chapters.flatMap((c) => c.photos),
    first = all[0],
    last = all.at(-1);
  return `<section class="story-album" aria-labelledby="album-title">
    <div class="album-heading"><h2 id="album-title">${year === 0 ? "His first year" : `Year ${year + 1} with Winnie`}</h2><label class="album-year"><span class="sr-only">Year of Winnie's life</span><select id="album-year">${Array.from({ length: maxYear + 1 }, (_, i) => `<option value="${i}" ${i === year ? "selected" : ""}>${i === 0 ? "First year" : `Year ${i + 1}`}</option>`).join("")}</select></label></div>
    ${first && last && first.photo.id !== last.photo.id ? `<div class="album-bookends"><button data-open="${esc(first.event.id)}">${image(first)}<span>${esc(ageAt(first.day))}</span></button><button data-open="${esc(last.event.id)}">${image(last)}<span>${esc(ageAt(last.day))}</span></button></div>` : ""}
    <nav class="album-months" aria-label="Chapters by age">${chapters.map((c) => `<button data-album-month="${c.month}" aria-pressed="${c.month === current.month}" aria-label="${esc(c.title)}${c.photos.length ? "" : ", no photos yet"}"><span>${c.month === 0 ? "First weeks" : `${c.month} mo`}</span>${c.cover ? '<span class="album-has-photo" aria-hidden="true"></span>' : ""}</button>`).join("")}</nav>
    <article class="album-chapter" aria-label="${esc(current.title)}"><div class="album-chapter-heading"><h3>${esc(current.title)}</h3><span class="fine">${current.photos.length} ${current.photos.length === 1 ? "photo" : "photos"}</span></div>
    ${p ? `<button class="album-cover" data-open="${esc(p.event.id)}" aria-label="Open memory from ${esc(p.day)}">${image(p)}</button><div class="album-photo-context"><time datetime="${p.day}">${dayLabel(p.day)}</time>${p.location ? `<span>${esc(p.location)}</span>` : ""}</div>${p.event.note ? `<p class="album-caption">${esc(p.event.note)}</p>` : ""}${recollectionsHTML(p.event)}<div class="album-actions"><button class="primary" data-recollect="${esc(p.event.id)}" data-memory-photo="${esc(p.photo.id)}">${p.event.recollections?.[sync.session?.person]?.text ? "Edit my recollection" : "Add a recollection"}</button><button class="text-button" data-album-cover="${current.month}">Choose cover</button><button class="text-button" data-album-browse="${current.month}">See all photos</button></div>` : `<div class="album-empty"><h4>A place for his ${current.month === 0 ? "first weeks" : `${current.month}-month photos`}</h4><p>${dayLabel(current.start)} to ${dayLabel(new Date(Date.parse(current.end) - 864e5).toISOString().slice(0, 10))}</p><button class="primary" data-album-add>Add photos from this time</button></div>`}
    ${current.milestones.length ? `<div class="album-milestones">${current.milestones.map((e) => `<button class="text-button" data-open="${esc(e.id)}">${esc(e.milestone)}<time>${dayLabel(recordDay(e))}</time></button>`).join("")}</div>` : ""}</article>
    <div class="album-export"><button class="secondary" data-album-save ${all.length ? "" : "disabled"}>Save this album</button><span class="fine">Monthly covers and your words, to keep or print.</span></div>
  </section>`;
}
export function bindStoryAlbum() {
  if ($("album-year"))
    $("album-year").onchange = (e) => {
      year = Number(e.target.value);
      chapterMonth = null;
      changed();
      $("album-year")?.focus();
    };
}

async function photoData(photoId) {
  const blob = await sync.photo(photoId),
    url = URL.createObjectURL(blob),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1100 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function saveAlbum(button) {
  const chapters = chapterData(),
    title = year === 0 ? "Winnie's first year" : `Winnie: year ${year + 1}`;
  button.disabled = true;
  try {
    const pages = [];
    for (const c of chapters.filter((c) => c.cover)) {
      button.textContent = `Preparing ${c.title.toLowerCase()}…`;
      const p = c.cover,
        src = await photoData(p.photo.id);
      pages.push(
        `<article><h2>${esc(c.title)}</h2><img src="${src}" alt="Winnie"><p class="date">${dayLabel(p.day)}${p.location ? "<br>" + esc(p.location) : ""}</p>${p.event.note ? `<p>${esc(p.event.note)}</p>` : ""}${recollectionsHTML(p.event)}${c.milestones.map((e) => `<p>${esc(e.milestone)}<br><small>${dayLabel(recordDay(e))}</small></p>`).join("")}</article>`,
      );
    }
    const documentHTML = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#eef0fb;color:#242445;font:18px/1.6 Georgia,serif}header,article{max-width:760px;margin:auto;padding:36px 24px}h1{font-size:42px;line-height:1.1}h2{font-size:30px}img{display:block;width:100%;max-height:65vh;object-fit:contain}p,blockquote{white-space:pre-wrap}blockquote{margin:24px 0;font-style:italic}footer,.date,small{font:15px/1.6 system-ui;color:#575774}button{font:16px system-ui;padding:12px;background:#242445;color:white;border:0;cursor:pointer}@media print{body{background:white}button{display:none}article{break-before:page;break-inside:avoid}img{max-height:55vh}header{padding-top:20vh}}</style><header><h1>${esc(title)}</h1><button onclick="window.print()">Print or save as PDF</button></header>${pages.join("")}</html>`;
    download(
      new Blob([documentHTML], { type: "text/html" }),
      `winnie-year-${year + 1}.html`,
      "text/html",
    );
    toast("Album saved. Open it to read, print or save as PDF.");
  } catch {
    throw Error(
      "An album photo could not be loaded. Reconnect and try saving again.",
    );
  } finally {
    button.disabled = false;
    button.textContent = "Save this album";
  }
}
document.addEventListener(
  "click",
  safe(async (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-album-month")) {
      chapterMonth = Number(b.dataset.albumMonth);
      changed();
      document
        .querySelector(`[data-album-month="${chapterMonth}"]`)
        ?.focus({ preventScroll: true });
    }
    if (b.hasAttribute("data-album-add")) addPhotos();
    if (b.hasAttribute("data-album-save")) await saveAlbum(b);
    if (
      b.hasAttribute("data-album-cover") ||
      b.hasAttribute("data-album-browse")
    ) {
      const cover = b.hasAttribute("data-album-cover"),
        month = Number(cover ? b.dataset.albumCover : b.dataset.albumBrowse),
        chapter = chapterData().find((c) => c.month === month);
      pickMemoryPhoto({
        title: cover ? "Choose his chapter cover" : chapter.title,
        photos: chapter.photos.toReversed(),
        onChoose: async (p) => {
          if (!cover) {
            detail(p.event.id);
            return;
          }
          const profile = sync.view().profile;
          await sync.enqueue(
            "profile",
            null,
            { storyCovers: { ...profile.storyCovers, [month]: p.photo.id } },
            profile.revision,
          );
          closeDialog();
          changed();
          toast("Chapter cover saved on this device.");
        },
      });
    }
  }),
);

export function choosePostcard(onChoose) {
  pickMemoryPhoto({
    title: "Choose a postcard photo",
    photos: selectedPhotos(facts()),
    onChoose: (p) => {
      closeDialog();
      onChoose(p.photo.id);
    },
  });
}
