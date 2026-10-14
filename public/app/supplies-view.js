import { SUPPLIES, STOCK, validateSupplies } from "../routine.js?v=4.20";
import { careStates } from "../care-plans.js?v=4.20";
import { sync } from "./services.js?v=4.20";
import { $, esc, dateLabel } from "./format.js?v=4.20";
import { openDialog, closeDialog, safe, toast } from "./ui.js?v=4.20";

export function suppliesHTML() {
  const profile = sync.view().profile,
    medication = careStates(profile, sync.view().events).find(
      (s) =>
        s.plan.type === "medication" &&
        /h[ae]artgard/i.test(s.plan.title) &&
        !s.paused,
    );
  return `<div class="supply-list">${SUPPLIES.map(([id, name]) => {
    const item = profile.supplies?.find((s) => s.id === id),
      status = item?.status || "unknown";
    return `<article class="supply-row"><div><h3>${name}</h3><span class="stock-status ${status}">${STOCK[status]}</span>${id === "heartgard" ? `<button class="text-button supply-dose" data-care-action="${medication ? "open" : "new"}" ${medication ? `data-plan="${esc(medication.plan.id)}"` : 'data-template="heartgard"'}>${medication?.due ? `Next dose ${dateLabel(Date.parse(medication.due + "T12:00:00"))}` : "Set monthly dose reminder"}</button>` : ""}</div><div class="supply-actions">${item?.link ? `<a class="text-button" href="${esc(item.link)}" target="_blank" rel="noopener">Reorder</a>` : ""}<button class="px btn" data-supply="${id}" aria-label="Update ${name.toLowerCase()}">Update</button></div></article>`;
  }).join("")}</div>`;
}

function editSupply(id) {
  const name = SUPPLIES.find(([key]) => key === id)?.[1];
  if (!name) return;
  const profile = sync.view().profile,
    item = profile.supplies?.find((s) => s.id === id);
  openDialog(
    `<h2 id="dialog-title">${name}</h2><form id="supply-form"><fieldset class="stock-options"><legend>On hand</legend>${Object.entries(
      STOCK,
    )
      .map(
        ([value, label]) =>
          `<label><input type="radio" name="status" value="${value}" ${(item?.status || "unknown") === value ? "checked" : ""}><span>${label}</span></label>`,
      )
      .join(
        "",
      )}</fieldset><label>Reorder link <span class="fine">Optional</span><input type="url" name="link" maxlength="1000" value="${esc(item?.link || "")}" placeholder="https://"></label>${item ? `<p class="fine">Last checked ${dateLabel(item.updatedAt)}</p>` : ""}<div class="button-row"><button class="primary">Save</button><button class="secondary" type="button" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
  );
  $("supply-form").onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const button = ev.target.querySelector(".primary"),
      data = new FormData(ev.target);
    button.disabled = true;
    try {
      const supplies = validateSupplies([
        ...(profile.supplies || []).filter((s) => s.id !== id),
        {
          id,
          status: data.get("status"),
          link: String(data.get("link") || "").trim(),
          updatedAt: Date.now(),
        },
      ]);
      await sync.enqueue("profile", null, { supplies }, profile.revision);
      closeDialog();
      toast(`${name} updated`);
    } finally {
      button.disabled = false;
    }
  });
}
document.addEventListener(
  "click",
  safe((ev) => {
    const button = ev.target.closest("[data-supply]");
    if (button) editSupply(button.dataset.supply);
  }),
);
