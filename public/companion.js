export function createWinnieCompanion(button) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let walk = null,
    sleeping = false,
    stopped = false;
  let blinkTimer,
    blinkEnd,
    moveTimer,
    happyEnd,
    refreshFrame,
    idleUntil = 0;
  const busy = () =>
    document.hidden ||
    !!document.querySelector("dialog[open]") ||
    document.activeElement?.matches(
      "input, textarea, select, [contenteditable]",
    ) ||
    button.matches(":focus-visible") ||
    Date.now() < idleUntil;
  const paused = () =>
    stopped || reduced.matches || sleeping || busy() || button.hidden;
  const stopWalk = () => {
    clearTimeout(walk);
    walk = null;
    button.classList.remove("walking");
  };
  const stopBlink = () => {
    clearTimeout(blinkEnd);
    button.classList.remove("blinking");
  };
  function refresh() {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      if (stopped) return;
      button.hidden = false;
      if (busy()) {
        stopWalk();
        stopBlink();
      }
    });
  }
  function scheduleBlink(delay = 2800 + Math.random() * 4200) {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (!paused() && !walk && !button.classList.contains("delighted")) {
        button.classList.add("blinking");
        blinkEnd = setTimeout(stopBlink, 150);
      }
      if (!stopped) scheduleBlink();
    }, delay);
  }
  function scheduleMove(delay = 6500 + Math.random() * 5000) {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!paused()) wander();
      if (!stopped) scheduleMove();
    }, delay);
  }
  function wander() {
    if (walk || button.classList.contains("delighted")) return;
    stopBlink();
    button.dataset.facing = button.dataset.facing === "left" ? "right" : "left";
    button.classList.add("walking");
    walk = setTimeout(stopWalk, 1200);
  }
  function celebrate() {
    refresh();
    stopWalk();
    stopBlink();
    clearTimeout(happyEnd);
    button.classList.remove("delighted");
    void button.offsetWidth;
    button.classList.add("delighted");
    idleUntil = Date.now() + 2200;
    happyEnd = setTimeout(() => button.classList.remove("delighted"), 1600);
    scheduleMove(2600);
  }
  function setSleeping(value) {
    const changed = sleeping !== !!value;
    sleeping = !!value;
    button.dataset.state = sleeping ? "sleeping" : "awake";
    button.setAttribute(
      "aria-label",
      sleeping
        ? "Pixel Winnie is sleeping. Give him a gentle pat."
        : "Give pixel Winnie a pat",
    );
    if (sleeping) {
      stopWalk();
      stopBlink();
      clearTimeout(blinkTimer);
      clearTimeout(moveTimer);
    } else if (changed && !document.hidden && !reduced.matches) {
      scheduleBlink();
      scheduleMove(2600);
    }
    refresh();
  }
  const interact = () => {
    idleUntil = Date.now() + 3500;
    stopWalk();
    stopBlink();
  };
  const focus = () => {
    if (busy()) {
      stopWalk();
      stopBlink();
    }
  };
  const preference = () => {
    stopWalk();
    stopBlink();
    clearTimeout(blinkTimer);
    clearTimeout(moveTimer);
    refresh();
    if (!document.hidden && !reduced.matches && !sleeping) {
      scheduleBlink();
      scheduleMove();
    }
  };
  button.addEventListener("click", celebrate);
  document.addEventListener("pointerdown", interact, { passive: true });
  document.addEventListener("focusin", focus);
  document.addEventListener("visibilitychange", preference);
  addEventListener("scroll", refresh, { passive: true });
  addEventListener("resize", refresh, { passive: true });
  reduced.addEventListener("change", preference);
  const dialogObserver = new MutationObserver(refresh);
  document.querySelectorAll("dialog").forEach((d) =>
    dialogObserver.observe(d, {
      attributes: true,
      attributeFilter: ["open"],
    }),
  );
  refresh();
  if (!reduced.matches && !document.hidden) {
    scheduleBlink(1800);
    scheduleMove(5000);
  }
  return {
    refresh,
    celebrate,
    setSleeping,
    destroy() {
      stopped = true;
      stopWalk();
      stopBlink();
      clearTimeout(blinkTimer);
      clearTimeout(moveTimer);
      clearTimeout(happyEnd);
      cancelAnimationFrame(refreshFrame);
      dialogObserver.disconnect();
      button.removeEventListener("click", celebrate);
      document.removeEventListener("pointerdown", interact);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", preference);
      removeEventListener("scroll", refresh);
      removeEventListener("resize", refresh);
      reduced.removeEventListener("change", preference);
    },
  };
}
