// The zoom stage the product lightbox and the Library viewer share (viewer trd D7; spec R4, Q9).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MAX_ZOOM_SCALE } from "@server/catalog/media";
import { ZoomableImage } from "@/components/shared/zoomable-image";

afterEach(cleanup);

const stage = () => screen.getByRole("img", { name: "Kurta" }).parentElement as HTMLElement;
const scaleOf = () => Number(/scale\(([\d.]+)\)/.exec(stage().style.transform)?.[1] ?? NaN);
const area = () => stage().parentElement as HTMLElement;

const swipe = (fromX: number, toX: number) => {
  fireEvent.touchStart(area(), { touches: [{ clientX: fromX, clientY: 100 }] });
  fireEvent.touchMove(area(), { touches: [{ clientX: toX, clientY: 100 }] });
  fireEvent.touchEnd(area(), { touches: [] });
};

describe("ZoomableImage", () => {
  it("the wheel zooms, never past the declared cap (spec A4)", () => {
    render(<ZoomableImage src="/a.jpg" alt="Kurta" />);
    expect(scaleOf()).toBe(1);
    fireEvent.wheel(area(), { deltaY: -250 });
    expect(scaleOf()).toBeCloseTo(1.5);
    for (let i = 0; i < 20; i++) fireEvent.wheel(area(), { deltaY: -500 });
    expect(scaleOf()).toBe(MAX_ZOOM_SCALE);
  });

  it("a pinch zooms (spec A4)", () => {
    render(<ZoomableImage src="/a.jpg" alt="Kurta" />);
    fireEvent.touchStart(area(), { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(area(), { touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }] });
    expect(scaleOf()).toBe(2);
  });

  it("an unzoomed swipe moves to the next or previous picture", () => {
    const next = vi.fn();
    const previous = vi.fn();
    render(<ZoomableImage src="/a.jpg" alt="Kurta" onSwipeNext={next} onSwipePrevious={previous} />);
    swipe(300, 100);
    expect(next).toHaveBeenCalledTimes(1);
    swipe(100, 300);
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it("a zoomed drag pans instead of swiping", () => {
    const next = vi.fn();
    render(<ZoomableImage src="/a.jpg" alt="Kurta" onSwipeNext={next} />);
    fireEvent.wheel(area(), { deltaY: -500 });
    swipe(300, 100);
    expect(next).not.toHaveBeenCalled();
  });

  it("a new picture starts unzoomed", () => {
    const { rerender } = render(<ZoomableImage src="/a.jpg" alt="Kurta" />);
    fireEvent.wheel(area(), { deltaY: -500 });
    expect(scaleOf()).toBeGreaterThan(1);
    rerender(<ZoomableImage src="/b.jpg" alt="Kurta" />);
    expect(scaleOf()).toBe(1);
  });

  it("shows the picture whole, at its own proportions (spec A1)", () => {
    render(<ZoomableImage src="/a.jpg" alt="Kurta" />);
    const img = screen.getByRole("img", { name: "Kurta" });
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
  });
});
