// Native selection belongs to one editing/copy surface, never the entire app.
const SELECTABLE =
  'input, textarea, [contenteditable="true"], [contenteditable=""], .detail-notes, pre';
export function selectionSurface(node) {
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  return element?.closest?.(SELECTABLE) || null;
}
export function allowedSelection(selection) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return true;
  const surface = selectionSurface(selection.anchorNode);
  if (!surface || selectionSurface(selection.focusNode) !== surface)
    return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (
      !surface.contains(range.startContainer) ||
      !surface.contains(range.endContainer)
    )
      return false;
  }
  return true;
}
export function protectAppSelection(doc = document) {
  const clear = () => {
    const selection = doc.getSelection();
    if (!allowedSelection(selection)) selection.removeAllRanges();
  };
  doc.addEventListener("selectionchange", clear);
  doc.addEventListener("selectstart", (event) => {
    if (!selectionSurface(event.target)) event.preventDefault();
  });
  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (!selectionSurface(event.target))
        doc.getSelection()?.removeAllRanges();
    },
    { passive: true },
  );
  doc.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "a" &&
      !selectionSurface(doc.activeElement) &&
      !selectionSurface(doc.getSelection()?.anchorNode)
    ) {
      event.preventDefault();
      clear();
    }
  });
  doc.addEventListener("dragstart", (event) => {
    if (!selectionSurface(event.target)) event.preventDefault();
  });
  clear();
}
