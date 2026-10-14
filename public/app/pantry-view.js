// Food on hand: the Food section in Plans, "Order food" in Up next, restocking and editing.
import { pantryState, emptyPantry, lastEaten } from "../pantry.js?v=4.21";
import { icon } from "../icons.js?v=4.0";
import { facts, sync } from "./services.js?v=4.21";
import { $, esc, face, person } from "./format.js?v=4.21";
import { closeDialog, openDialog, safe, toast } from "./ui.js?v=4.21";
import { render } from "./today.js?v=4.21";

const DAY = 86400000;
const short = new Intl.DateTimeFormat([], { month: "short", day: "numeric" });
const weekday = new Intl.DateTimeFormat([], { weekday: "short" });
const meals = (n) => {
  const r = Math.round(n * 10) / 10;
  return `${r} ${r === 1 ? "meal" : "meals"}`;
};
const days = (d) => (d < 1 ? "under a day" : `about ${Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`);
const ago = (t) => {
  if (!t) return "not eaten yet";
  const d = Math.floor((Date.now() - t) / DAY);
  return d <= 0 ? "eaten today" : d < 7 ? `eaten ${weekday.format(t)}` : `eaten ${short.format(t)}`;
};

export const pantryNow = () => pantryState(sync.view().profile.pantry, facts());

export async function savePantry(change) {
  const profile = sync.view().profile,
    next = structuredClone(profile.pantry || emptyPantry());
  change(next);
  await sync.enqueue("profile", null, { pantry: next }, profile.revision);
}

// Plans tab
export function pantryHTML() {
  const s = pantryNow();
  if (!s.foods.length)
    return `<section class="card pantry" aria-labelledby="pantry-title"><div class="card-head"><h2 id="pantry-title">Food</h2></div><div class="row"><span class="sq" style="--c:var(--meal)">${icon("meal", "ic sm")}</span><div><b>No foods yet</b></div><button class="px btn ink" data-pantry="new">Add food</button></div></section>`;
  const rows = s.foods
    .map((f) => {
      const pct = Math.min(100, (f.left / Math.max(f.perPackage, f.left || 1)) * 100);
      return `<div class="food-row"><span class="sq" style="--c:var(--meal)">${icon("meal", "ic sm")}</span><div class="food-main"><b>${esc(f.name)}</b><small>${meals(f.left)} left</small><small>${ago(lastEaten(f.name, facts()))}</small><span class="meter${s.low && f.left < f.perPackage ? " low" : ""}" aria-hidden="true"><i style="width:${pct.toFixed(0)}%"></i></span></div><span class="food-acts">${f.link ? `<a class="px btn" href="${esc(f.link)}" target="_blank" rel="noopener">Reorder</a>` : ""}<button class="px btn" data-pantry="restock" data-id="${esc(f.id)}" aria-label="Add a bag of ${esc(f.name)}">+ Bag</button><button class="text-button" data-pantry="edit" data-id="${esc(f.id)}">Edit</button></span></div>`;
    })
    .join("");
  return `<section class="card pantry" aria-labelledby="pantry-title"><div class="card-head"><h2 id="pantry-title">Food</h2><span class="muted">${s.daysLeft === null ? "" : days(s.daysLeft) + " left"}</span></div>${rows}<div class="button-row"><button class="px btn" data-pantry="new">Add food</button><button class="text-button" data-pantry="lead">Delivery: ${s.leadDays} ${s.leadDays === 1 ? "day" : "days"}</button></div></section>`;
}

// Today: Up next
export function pantryNextHTML() {
  const s = pantryNow();
  if (s.ordered)
    return `<div class="row"><span class="sq" style="--c:var(--meal)">${icon("meal", "ic sm")}</span><div><b>Food ordered</b><small>${face(s.ordered.by, "xs")}${esc(person(s.ordered.by))} · ${short.format(s.ordered.at)}</small></div><button class="px btn" data-pantry="arrived">Arrived</button></div>`;
  if (!s.low) return "";
  const lowest = [...s.foods].sort((a, b) => a.days - b.days)[0],
    link = lowest?.link || s.foods.find((f) => f.link)?.link;
  return `<div class="row"><span class="sq" style="--c:var(--amber)">${icon("meal", "ic sm")}</span><div><b>Order food</b><small>${days(s.daysLeft)} left${lowest ? ` · ${esc(lowest.name)} lowest` : ""}</small></div><span class="button-row">${link ? `<a class="px btn ink" href="${esc(link)}" target="_blank" rel="noopener">Reorder</a>` : ""}<button class="px btn" data-pantry="ordered">Ordered</button></span></div>`;
}

function foodSheet(id) {
  const openedAt = Date.now(), profileRevision = sync.view().profile.revision;
  const s = pantryNow(),
    f = s.foods.find((x) => x.id === id);
  openDialog(
    `<h2 id="dialog-title">${f ? esc(f.name) : "Add food"}</h2><form id="food-form"><label>Name<input name="name" maxlength="40" required value="${esc(f?.name || "")}" placeholder="Beef" autocomplete="off"></label><label>Meals per bag<input name="perPackage" type="number" inputmode="numeric" min="1" max="500" required value="${f?.perPackage || 14}"></label><label>Meals on hand now<input name="servings" type="number" inputmode="decimal" min="0" max="5000" step="0.5" required value="${f ? Math.round(f.left * 10) / 10 : 14}"></label><label>Amazon link<input name="link" type="url" maxlength="1000" value="${esc(f?.link || "")}" placeholder="https://www.amazon.com/dp/…"></label><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save</button>${f ? `<button type="button" class="text-button danger" data-pantry="remove" data-id="${esc(f.id)}">Remove</button>` : ""}</div></form>`,
  );
  $("food-form").onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const v = new FormData(ev.target),
      name = String(v.get("name")).trim(),
      link = String(v.get("link") || "").trim();
    if (link && !/^https:\/\//.test(link)) throw Error("Use a full https:// link.");
    if (sync.view().profile.revision !== profileRevision || (f && pantryNow().foods.find(x => x.id === id)?.left !== f.left))
      throw Error("Food stock changed while this form was open. Reopen it to use the latest count.");
    await savePantry((p) => {
      const item = {
        id: f?.id || crypto.randomUUID().slice(0, 18),
        name,
        perPackage: Number(v.get("perPackage")),
        link,
        count: { servings: Number(v.get("servings")), at: openedAt },
      };
      p.foods = f ? p.foods.map((x) => (x.id === f.id ? item : x)) : [...p.foods, item];
      p.hiddenFoods = (p.hiddenFoods || []).filter(x => x.toLowerCase() !== name.toLowerCase());
    });
    closeDialog();
    toast(`${name} saved`);
  });
}

async function restock(id, bags = 1) {
  const f = pantryNow().foods.find((x) => x.id === id);
  if (!f) return;
  await savePantry((p) => {
    const item = p.foods.find((x) => x.id === id);
    item.count = { servings: Math.round((f.left + f.perPackage * bags) * 10) / 10, at: Date.now() };
    p.ordered = null;
  });
  toast(`${f.name} +${f.perPackage * bags} meals`);
}

function arrivedSheet() {
  const s = pantryNow();
  openDialog(
    `<h2 id="dialog-title">Food arrived</h2><div class="sheet-section">${s.foods
      .map(
        (f) =>
          `<div class="food-row"><span class="sq" style="--c:var(--meal)">${icon("meal", "ic sm")}</span><div class="food-main"><b>${esc(f.name)}</b><small>${meals(f.left)}</small></div><span class="food-acts"><button class="px btn" data-pantry="restock" data-id="${esc(f.id)}" aria-label="Add a bag of ${esc(f.name)}">+ Bag</button></span></div>`,
      )
      .join("")}</div><div class="button-row"><button class="px btn ink" data-pantry="done-arrived">Done</button></div>`,
  );
}

function leadSheet() {
  const s = pantryNow();
  openDialog(
    `<h2 id="dialog-title">Delivery time</h2><div class="offsets">${[1, 2, 3, 4, 5, 7, 10]
      .map((d) => `<button class="px" aria-pressed="${d === s.leadDays}" data-pantry="set-lead" data-days="${d}">${d} ${d === 1 ? "day" : "days"}</button>`)
      .join("")}</div>`,
  );
}

document.addEventListener(
  "click",
  safe(async (ev) => {
    const b = ev.target.closest("button[data-pantry]");
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.pantry) {
      case "new":
        return foodSheet();
      case "edit":
        return foodSheet(id);
      case "restock":
        b.disabled = true;
        try {
          await restock(id);
        } finally {
          b.disabled = false;
        }
        if ($("dialog").open && $("dialog-title")?.textContent === "Food arrived") arrivedSheet();
        return;
      case "remove":
        await savePantry((p) => {
          const food = p.foods.find(x => x.id === id);
          if (food) p.hiddenFoods = [...new Set([...(p.hiddenFoods || []), food.name.toLowerCase()])];
          p.foods = p.foods.filter((x) => x.id !== id);
        });
        closeDialog();
        return toast("Food removed");
      case "ordered":
        await savePantry((p) => (p.ordered = { by: sync.session.person, at: Date.now() }));
        return toast("Marked ordered");
      case "arrived":
        return arrivedSheet();
      case "done-arrived":
        await savePantry((p) => (p.ordered = null));
        closeDialog();
        return render();
      case "lead":
        return leadSheet();
      case "set-lead":
        await savePantry((p) => (p.leadDays = Number(b.dataset.days)));
        return closeDialog();
    }
  }),
);
