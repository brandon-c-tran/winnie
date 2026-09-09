import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { laneBounds, clearPath } from "../public/companion.js";

test("Winnie stays fully inside a visible reserved lane, including narrow phones", () => {
  const viewport = { width: 320, height: 740 };
  assert.deepEqual(
    laneBounds({ left: 14, right: 306, top: 350, height: 64 }, viewport),
    { minX: 14, maxX: 242, y: 350 },
  );
  assert.equal(
    laneBounds({ left: 14, right: 306, top: 700, height: 64 }, viewport),
    null,
  );
  assert.equal(
    laneBounds({ left: 14, right: 70, top: 350, height: 64 }, viewport),
    null,
  );
  assert.equal(
    laneBounds({ left: 14, right: 306, top: -10, height: 64 }, viewport),
    null,
  );
  assert.equal(
    laneBounds({ left: 14, right: 306, top: 350, height: 0 }, viewport),
    null,
  );
});
test("a walk cannot cross a control, text, photo, or its touch margin", () => {
  const from = { x: 20, y: 200 },
    to = { x: 230, y: 200 };
  assert.equal(clearPath(from, to, []), true);
  assert.equal(
    clearPath(from, to, [{ left: 140, right: 180, top: 190, bottom: 260 }]),
    false,
  );
  assert.equal(
    clearPath(from, to, [{ left: 140, right: 180, top: 266, bottom: 300 }]),
    false,
  );
  assert.equal(
    clearPath(from, to, [{ left: 140, right: 180, top: 275, bottom: 300 }]),
    true,
  );
  assert.equal(
    clearPath(from, { x: 230, y: 400 }, [
      { left: 140, right: 180, top: 310, bottom: 350 },
    ]),
    false,
  );
});
test("every declared icon has the correct raster dimensions and keeps app identity", () => {
  const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
  assert.equal(manifest.start_url, ".");
  for (const icon of manifest.icons) {
    const png = fs.readFileSync("public/" + icon.src),
      [w, h] = icon.sizes.split("x").map(Number);
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
    assert.equal(icon.purpose, "any maskable");
  }
  for (const size of [32, 180]) {
    const png = fs.readFileSync(`public/icons/winnie-v2-${size}.png`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const sprite = fs.readFileSync("public/photos/winnie-pixel-v2.png");
  assert.equal(sprite.readUInt32BE(16) / 3, sprite.readUInt32BE(20) / 2);
});

test("blink and wandering stop for sleep, editing, and reduced-motion preferences", async (t) => {
  const { createWinnieCompanion } = await import("../public/companion.js");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(Math, "random", () => 0.5);
  const saved = new Map(),
    listeners = new Map(),
    classes = new Set();
  let editing = false,
    animations = 0;
  const media = {
    matches: false,
    addEventListener: (_n, fn) => listeners.set("motion", fn),
    removeEventListener() {},
  };
  const button = {
    style: {},
    dataset: {},
    hidden: false,
    offsetWidth: 64,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    matches: () => false,
    contains: () => false,
    setAttribute() {},
    getBoundingClientRect: () => ({ left: 20, top: 200 }),
    addEventListener() {},
    removeEventListener() {},
    animate() {
      animations++;
      return { cancel() {}, onfinish: null };
    },
  };
  const lane = {
    getClientRects: () => [1],
    getBoundingClientRect: () => ({
      left: 20,
      right: 355,
      top: 200,
      height: 64,
    }),
  };
  const doc = {
    body: {},
    hidden: false,
    activeElement: { matches: () => editing },
    querySelector: () => null,
    querySelectorAll: (selector) =>
      selector === "[data-winnie-lane]"
        ? [lane]
        : selector === "dialog"
          ? []
          : [button],
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener() {},
  };
  const env = {
    document: doc,
    matchMedia: () => media,
    innerWidth: 390,
    innerHeight: 844,
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame: (fn) => {
      fn();
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(env)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  let companion;
  try {
    companion = createWinnieCompanion(button);
    t.mock.timers.tick(1800);
    assert(classes.has("blinking"));
    t.mock.timers.tick(150);
    assert(!classes.has("blinking"));
    t.mock.timers.tick(3050);
    assert(classes.has("walking"));
    assert.equal(animations, 1);
    companion.setSleeping(true);
    assert(!classes.has("walking"));
    assert.equal(button.dataset.state, "sleeping");
    t.mock.timers.tick(20000);
    assert(!classes.has("blinking"));
    assert.equal(animations, 1);
    companion.setSleeping(false);
    editing = true;
    t.mock.timers.tick(20000);
    assert.equal(animations, 1);
    editing = false;
    media.matches = true;
    listeners.get("motion")();
    t.mock.timers.tick(20000);
    assert.equal(animations, 1);
    assert(!classes.has("blinking"));
  } finally {
    companion?.destroy();
    for (const [key, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  }
});
