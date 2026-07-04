// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findDragScroller, installDragScroll } from "@/shared/ui/dragScroll";

function makeScroller(): HTMLDivElement {
  const scroller = document.createElement("div");
  scroller.style.overflowX = "auto";
  Object.defineProperty(scroller, "scrollWidth", { value: 600, configurable: true });
  Object.defineProperty(scroller, "clientWidth", { value: 200, configurable: true });
  document.body.appendChild(scroller);
  return scroller;
}

function pointerEvent(
  type: string,
  init: MouseEventInit & { pointerId?: number; pointerType?: string }
): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  return event;
}

describe("dragScroll", () => {
  let uninstall: (() => void) | null = null;

  beforeEach(() => {
    uninstall = installDragScroll(document);
  });

  afterEach(() => {
    uninstall?.();
    document.body.innerHTML = "";
  });

  it("finds the nearest horizontally overflowing ancestor", () => {
    const scroller = makeScroller();
    const child = document.createElement("span");
    scroller.appendChild(child);

    expect(findDragScroller(child)).toBe(scroller);
    expect(findDragScroller(document.body)).toBeNull();
  });

  it("pans the scroller when dragging past the threshold", () => {
    const scroller = makeScroller();
    scroller.scrollLeft = 120;

    scroller.dispatchEvent(pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 10 }));
    scroller.dispatchEvent(pointerEvent("pointermove", { clientX: 60, clientY: 10 }));

    expect(scroller.scrollLeft).toBe(160);
    scroller.dispatchEvent(pointerEvent("pointerup", { clientX: 60, clientY: 10 }));
  });

  it("suppresses the click that ends a drag but not plain clicks", () => {
    const scroller = makeScroller();
    let clicks = 0;
    scroller.addEventListener("click", () => {
      clicks += 1;
    });

    scroller.dispatchEvent(pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 10 }));
    scroller.dispatchEvent(pointerEvent("pointermove", { clientX: 40, clientY: 10 }));
    scroller.dispatchEvent(pointerEvent("pointerup", { clientX: 40, clientY: 10 }));
    scroller.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(clicks).toBe(0);

    scroller.dispatchEvent(pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 10 }));
    scroller.dispatchEvent(pointerEvent("pointerup", { clientX: 101, clientY: 10 }));
    scroller.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(clicks).toBe(1);
  });

  it("does not start drags from text-entry controls", () => {
    const scroller = makeScroller();
    const input = document.createElement("input");
    scroller.appendChild(input);
    scroller.scrollLeft = 50;

    input.dispatchEvent(pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 10 }));
    input.dispatchEvent(pointerEvent("pointermove", { clientX: 10, clientY: 10 }));

    expect(scroller.scrollLeft).toBe(50);
  });

  it("ignores touch and pen pointers so native panning wins", () => {
    const scroller = makeScroller();
    scroller.scrollLeft = 50;

    scroller.dispatchEvent(
      pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 10, pointerType: "touch" })
    );
    scroller.dispatchEvent(pointerEvent("pointermove", { clientX: 10, clientY: 10, pointerType: "touch" }));

    expect(scroller.scrollLeft).toBe(50);
  });
});
