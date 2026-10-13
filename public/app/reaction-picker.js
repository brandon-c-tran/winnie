// One picker per screen, owned by the exact button that opened it.
// Inside a sheet it belongs to that dialog; native popovers supply the top layer.
export function createReactionPicker({ choices, getMine, choose }) {
  let anchor = null,
    panel = null,
    owner = null;
  function close(restore = false) {
    const previous = anchor;
    anchor = null;
    panel?.remove();
    panel = null;
    owner = null;
    previous?.setAttribute("aria-expanded", "false");
    previous?.removeAttribute("aria-controls");
    if (restore && previous?.isConnected)
      previous.focus({ preventScroll: true });
  }
  function position() {
    if (!anchor?.isConnected || !anchor.getClientRects().length) return close();
    const r = anchor.getBoundingClientRect(),
      p = panel.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    panel.style.left = `${Math.max(left + 10, Math.min(r.right - p.width, left + width - p.width - 10))}px`;
    const below = r.bottom + 8,
      above = r.top - p.height - 8,
      preferBelow =
        anchor.closest("dialog") && below + p.height <= top + height - 10;
    panel.style.top = `${Math.max(top + 10, Math.min(preferBelow || above < top + 10 ? below : above, top + height - p.height - 10))}px`;
  }
  function open(button) {
    if (anchor === button) return close(true);
    close();
    anchor = button;
    owner = button.parentElement.closest("[id]") || document.body;
    const id = button.dataset.reactionPicker;
    panel = document.createElement("div");
    panel.className = "reaction-picker";
    panel.id = "reaction-picker";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose your reaction");
    const mine = getMine(id);
    for (const [emoji, label] of choices) {
      const option = document.createElement("button");
      option.className = "reaction-chip";
      option.dataset.react = emoji;
      option.setAttribute(
        "aria-label",
        `${mine === emoji ? "Remove" : "React with"} ${label}`,
      );
      option.setAttribute("aria-pressed", String(mine === emoji));
      const symbol = document.createElement("span");
      symbol.textContent = emoji;
      symbol.setAttribute("aria-hidden", "true");
      const text = document.createElement("small");
      text.textContent = label;
      option.append(symbol, text);
      option.onclick = () => {
        close(true);
        choose(id, mine === emoji ? "" : emoji);
      };
      panel.append(option);
    }
    const supportsPopover = typeof panel.showPopover === "function";
    if (supportsPopover) panel.setAttribute("popover", "auto");
    (button.closest("dialog") || document.body).append(panel);
    if (supportsPopover) {
      panel.addEventListener("toggle", (ev) => {
        if (ev.newState === "closed" && ev.target === panel) close();
      });
      panel.showPopover();
    }
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", panel.id);
    position();
    (
      panel.querySelector('[aria-pressed="true"]') ||
      panel.querySelector("button")
    )?.focus({ preventScroll: true });
  }
  document.addEventListener(
    "pointerdown",
    (ev) => {
      // Safari focuses the enclosing dialog when tapping a button. Keep focus in
      // the picker until its click has run, rather than dismissing it mid-tap.
      if (panel?.contains(ev.target)) ev.preventDefault();
      else if (panel && !anchor.contains(ev.target)) close();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!panel) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        close(true);
      } else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) {
        ev.preventDefault();
        const buttons = [...panel.querySelectorAll("button")];
        const i = buttons.indexOf(document.activeElement);
        buttons[
          ev.key === "Home"
            ? 0
            : ev.key === "End"
              ? buttons.length - 1
              : (i + (ev.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                buttons.length
        ].focus();
      }
    },
    true,
  );
  document.addEventListener("focusin", (ev) => {
    if (panel && !panel.contains(ev.target) && ev.target !== anchor) close();
  });
  document.addEventListener("winnie:surface-change", () => close());
  document.addEventListener(
    "scroll",
    (ev) => {
      if (panel && !panel.contains(ev.target)) position();
    },
    true,
  );
  window.addEventListener("resize", () => close());
  window.visualViewport?.addEventListener("resize", () => close());
  return {
    open,
    close,
    refresh() {
      if (!anchor || anchor.isConnected) return;
      const replacement = owner?.querySelector(
        `[data-reaction-picker="${CSS.escape(anchor.dataset.reactionPicker)}"]`,
      );
      if (!replacement) return close();
      anchor = replacement;
      anchor.setAttribute("aria-expanded", "true");
      anchor.setAttribute("aria-controls", panel.id);
      position();
    },
  };
}
