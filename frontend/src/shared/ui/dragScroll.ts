const EXCLUDED_TARGET_SELECTOR =
  "input, textarea, select, option, [contenteditable=''], [contenteditable='true']";
const DRAG_THRESHOLD_PX = 6;
const DRAGGING_CLASS = "is-drag-scrolling";

interface DragState {
  pointerId: number;
  scroller: HTMLElement;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  engaged: boolean;
}

function isHorizontallyScrollable(element: HTMLElement): boolean {
  if (element.scrollWidth <= element.clientWidth + 1) {
    return false;
  }
  const overflowX = getComputedStyle(element).overflowX;
  return overflowX === "auto" || overflowX === "scroll";
}

export function findDragScroller(start: Element | null): HTMLElement | null {
  let node: HTMLElement | null = start instanceof HTMLElement ? start : null;
  while (node) {
    if (isHorizontallyScrollable(node)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Touch-style panning for mouse users: left-click and drag inside any
 * horizontally overflowing container scrolls it. Plain clicks pass through
 * untouched; a click at the end of a real drag is swallowed so buttons under
 * the pointer do not fire. Touch and pen input keep native browser panning.
 */
export function installDragScroll(doc: Document = document): () => void {
  let state: DragState | null = null;
  let suppressNextClick = false;

  const onPointerDown = (event: PointerEvent): void => {
    suppressNextClick = false;
    if (event.button !== 0 || event.pointerType !== "mouse" || state) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest(EXCLUDED_TARGET_SELECTOR)) {
      return;
    }
    const scroller = findDragScroller(target);
    if (!scroller) {
      return;
    }
    state = {
      pointerId: event.pointerId,
      scroller,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: scroller.scrollLeft,
      startScrollTop: scroller.scrollTop,
      engaged: false
    };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    const deltaX = event.clientX - state.startClientX;
    const deltaY = event.clientY - state.startClientY;
    if (!state.engaged) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX && Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
        return;
      }
      state.engaged = true;
      suppressNextClick = true;
      doc.documentElement.classList.add(DRAGGING_CLASS);
      try {
        state.scroller.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is unavailable in some environments (e.g. jsdom).
      }
    }
    state.scroller.scrollLeft = state.startScrollLeft - deltaX;
    state.scroller.scrollTop = state.startScrollTop - deltaY;
    event.preventDefault();
  };

  const endDrag = (event: PointerEvent): void => {
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    if (state.engaged) {
      doc.documentElement.classList.remove(DRAGGING_CLASS);
      try {
        state.scroller.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore environments without pointer capture.
      }
    }
    state = null;
  };

  const onClickCapture = (event: MouseEvent): void => {
    if (!suppressNextClick) {
      return;
    }
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("pointermove", onPointerMove, true);
  doc.addEventListener("pointerup", endDrag, true);
  doc.addEventListener("pointercancel", endDrag, true);
  doc.addEventListener("click", onClickCapture, true);

  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("pointermove", onPointerMove, true);
    doc.removeEventListener("pointerup", endDrag, true);
    doc.removeEventListener("pointercancel", endDrag, true);
    doc.removeEventListener("click", onClickCapture, true);
    doc.documentElement.classList.remove(DRAGGING_CLASS);
  };
}
