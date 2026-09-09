import test from "node:test";
import assert from "node:assert/strict";
import { allowedSelection, protectAppSelection } from "../public/selection.js";

test("only selections contained within one field or saved note survive", () => {
  const surface = { contains: (n) => n?.surface === surface };
  const other = { contains: (n) => n?.surface === other };
  const node = (owner) => ({
    nodeType: 1,
    surface: owner,
    closest: () => owner,
  });
  const start = node(surface),
    end = node(surface),
    outside = node(null);
  const selected = (a, b) => ({
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: a,
    focusNode: b,
    getRangeAt: () => ({ startContainer: a, endContainer: b }),
  });
  assert.equal(allowedSelection(selected(start, end)), true);
  assert.equal(allowedSelection(selected(outside, outside)), false);
  assert.equal(allowedSelection(selected(start, outside)), false);
  assert.equal(allowedSelection(selected(start, node(other))), false);
  assert.equal(allowedSelection({ isCollapsed: true }), true);
});

test("late native selection is cleared; field gestures and select-all remain available", () => {
  const listeners = new Map();
  let clears = 0,
    prevents = 0;
  const chrome = { nodeType: 1, closest: () => null };
  const field = {
    nodeType: 1,
    closest() {
      return this;
    },
    contains: () => true,
  };
  let selection = {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: chrome,
    focusNode: chrome,
    removeAllRanges() {
      clears++;
    },
  };
  const doc = {
    activeElement: chrome,
    getSelection: () => selection,
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  protectAppSelection(doc);
  assert.equal(clears, 1);
  listeners.get("selectionchange")();
  assert.equal(clears, 2);
  const event = (target) => ({ target, preventDefault: () => prevents++ });
  listeners.get("selectstart")(event(chrome));
  listeners.get("selectstart")(event(field));
  assert.equal(prevents, 1);
  listeners.get("keydown")({ ...event(chrome), ctrlKey: true, key: "a" });
  assert.equal(prevents, 2);
  doc.activeElement = field;
  listeners.get("keydown")({ ...event(field), metaKey: true, key: "a" });
  assert.equal(prevents, 2);
  selection = { isCollapsed: true };
  listeners.get("selectionchange")();
  assert.equal(clears, 3);
});
