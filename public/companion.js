const SIZE = 64;

// Keep the entire hit target inside a reserved lane and inside the viewport.
export function laneBounds(rect, viewport, size = SIZE) {
  const minX = Math.max(8, rect.left),
    maxX = Math.min(viewport.width - 8, rect.right) - size;
  if (
    rect.height < size ||
    maxX < minX ||
    rect.top < 8 ||
    rect.top + size > viewport.height - 8
  )
    return null;
  return { minX, maxX, y: rect.top };
}

export function clearPath(from, to, obstacles, size = SIZE) {
  const swept = {
    left: Math.min(from.x, to.x) - 4,
    right: Math.max(from.x, to.x) + size + 4,
    top: Math.min(from.y, to.y) - 4,
    bottom: Math.max(from.y, to.y) + size + 4,
  };
  return !obstacles.some(
    (r) =>
      r.left < swept.right &&
      r.right > swept.left &&
      r.top < swept.bottom &&
      r.bottom > swept.top,
  );
}

export function createWinnieCompanion(button) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let current = null,
    position = null,
    walk = null,
    sleeping = false,
    stopped = false;
  let blinkTimer,
    blinkEnd,
    moveTimer,
    happyEnd,
    refreshFrame,
    idleUntil = 0;
  const lanes = () =>
    [...document.querySelectorAll("[data-winnie-lane]")].flatMap((el) => {
      if (!el.getClientRects().length) return [];
      const bounds = laneBounds(el.getBoundingClientRect(), {
        width: innerWidth,
        height: innerHeight,
      });
      return bounds ? [{ el, ...bounds }] : [];
    });
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
  const put = (point) => {
    position = point;
    button.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
  };
  const stopWalk = () => {
    if (walk && !button.hidden) {
      const rect = button.getBoundingClientRect();
      put({ x: rect.left + scrollX, y: rect.top + scrollY });
    }
    walk?.cancel();
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
      const available = lanes();
      if (
        !available.length ||
        document.hidden ||
        document.querySelector("dialog[open]")
      ) {
        stopWalk();
        stopBlink();
        button.hidden = true;
        return;
      }
      const lane = available.find((l) => l.el === current) || available[0];
      const changed = current !== lane.el;
      current = lane.el;
      const next = {
        x:
          changed || !position
            ? lane.minX
            : Math.max(lane.minX, Math.min(lane.maxX, position.x - scrollX)),
        y: lane.y,
      };
      next.x += scrollX;
      next.y += scrollY;
      if (
        changed ||
        !position ||
        next.x !== position.x ||
        next.y !== position.y
      ) {
        stopWalk();
        put(next);
      }
      button.hidden = false;
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
    if (!position || walk || button.classList.contains("delighted")) return;
    const available = lanes(),
      here = available.find((l) => l.el === current);
    if (!here) {
      refresh();
      return;
    }
    // A different lane is used only when the whole route is clear of content.
    const targets = [...available.filter((l) => l.el !== current), here];
    const obstacles = [
      ...document.querySelectorAll(
        "button, input, select, textarea, a, img, h1, h2, h3, p, .card, .entry, #toast:not([hidden]), .portrait-label",
      ),
    ]
      .filter(
        (el) =>
          el !== button && !button.contains(el) && el.getClientRects().length,
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left + scrollX,
          right: r.right + scrollX,
          top: r.top + scrollY,
          bottom: r.bottom + scrollY,
        };
      });
    for (const lane of targets) {
      const midpoint = (lane.minX + lane.maxX) / 2 + scrollX;
      const target = {
        x: (position.x <= midpoint ? lane.maxX : lane.minX) + scrollX,
        y: lane.y + scrollY,
      };
      const distance = Math.hypot(target.x - position.x, target.y - position.y);
      if (distance < 28 || !clearPath(position, target, obstacles)) continue;
      stopBlink();
      button.dataset.facing = target.x < position.x ? "left" : "right";
      button.classList.add("walking");
      current = lane.el;
      const duration = Math.min(5000, Math.max(1000, (distance / 65) * 1000));
      const animation = button.animate(
        [
          { transform: `translate(${position.x}px, ${position.y}px)` },
          { transform: `translate(${target.x}px, ${target.y}px)` },
        ],
        { duration, easing: "linear" },
      );
      walk = animation;
      // The underlying position is the destination, so an interrupted walk settles safely.
      put(target);
      animation.onfinish = () => {
        if (walk !== animation) return;
        walk = null;
        button.classList.remove("walking");
      };
      return;
    }
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
  const observer = new ResizeObserver(refresh);
  observer.observe(document.body);
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
      observer.disconnect();
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
