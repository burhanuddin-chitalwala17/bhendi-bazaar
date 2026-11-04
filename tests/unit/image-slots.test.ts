/**
 * Image slots (image-slots spec R1, R3, R7): the declarations agree with the constants and tokens
 * that already describe the banner, a crop rectangle is held inside the picture and to the slot's
 * shape, and the position a crop becomes reproduces it. These fail quietly — a wrong position still
 * renders a picture, just not the part the uploader kept.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANNER_IMAGE } from "@/lib/config";
import {
  IMAGE_SLOT,
  IMAGE_SLOTS,
  frameProblem,
  isOffShape,
  largestFrame,
  positionOfFrame,
  ratioOf,
  toFractions,
  toPixels,
} from "@server/catalog/image-slots";

const CSS = readFileSync("src/app/globals.css", "utf8");
const token = (name: string) => {
  const match = CSS.match(new RegExp(`--${name}:\\s*(\\d+)\\s*/\\s*(\\d+)`));
  return match ? Number(match[1]) / Number(match[2]) : null;
};

describe("slot declarations", () => {
  const banner = IMAGE_SLOTS[IMAGE_SLOT.HOME_BANNER];

  it("the home banner's desktop shape is BANNER_IMAGE and --aspect-banner-source", () => {
    expect(banner.desktop.width).toBe(BANNER_IMAGE.width);
    expect(banner.desktop.height).toBe(BANNER_IMAGE.height);
    expect(token("aspect-banner-source")).toBe(ratioOf(banner.desktop));
  });

  it("the home banner's phone shape is 4:5 and --aspect-banner-phone", () => {
    expect(ratioOf(banner.phone)).toBe(4 / 5);
    expect(token("aspect-banner-phone")).toBe(ratioOf(banner.phone));
  });

  it("a shop's banner draws in the same hero, so it has the same shapes", () => {
    expect(IMAGE_SLOTS[IMAGE_SLOT.ORG_BANNER]).toEqual(banner);
  });

  it("every slot asks for no more than it declares", () => {
    for (const slot of Object.values(IMAGE_SLOTS)) {
      for (const shape of [slot.desktop, slot.phone]) expect(shape.minWidth).toBeLessThanOrEqual(shape.width);
    }
  });
});

describe("crop arithmetic", () => {
  const desktop = IMAGE_SLOTS[IMAGE_SLOT.HOME_BANNER].desktop;

  it("calls a picture within 2% the slot's shape, and 1600×660 off it", () => {
    expect(isOffShape(1600, 640, desktop)).toBe(false);
    expect(isOffShape(1600, 645, desktop)).toBe(false);
    expect(isOffShape(1600, 660, desktop)).toBe(true);
  });

  it("starts Keep it exact from the largest centred frame of the shape", () => {
    const frame = largestFrame(1600, 800, desktop);
    expect(frame.width).toBe(1);
    expect(frame.height).toBeCloseTo(0.8);
    expect(frame.y).toBeCloseTo(0.1);
  });

  it("turns a frame into the object-position that shows it", () => {
    // A frame flush with the top shows the top; flush with the bottom, the bottom.
    expect(positionOfFrame({ x: 0, y: 0, width: 1, height: 0.8 })).toEqual({ x: 0.5, y: 0 });
    expect(positionOfFrame({ x: 0, y: 0.2, width: 1, height: 0.8 }).y).toBeCloseTo(1);
    expect(positionOfFrame({ x: 0.25, y: 0, width: 0.5, height: 1 }).x).toBeCloseTo(0.5);
  });

  it("round-trips fractions and pixels", () => {
    const px = toPixels({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }, 2000, 1000);
    expect(px).toEqual({ x: 200, y: 200, width: 1000, height: 400 });
    expect(toFractions(px, 2000, 1000)).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 });
  });

  it("refuses a frame outside the picture", () => {
    expect(frameProblem({ x: 100, y: 0, width: 1600, height: 640 }, 1600, 660, desktop)).toMatch(/outside/);
    expect(frameProblem({ x: 0, y: 30, width: 1600, height: 640 }, 1600, 660, desktop)).toMatch(/outside/);
    expect(frameProblem({ x: -1, y: 0, width: 1600, height: 640 }, 1600, 660, desktop)).toMatch(/outside/);
  });

  it("refuses a frame that is not the slot's shape", () => {
    expect(frameProblem({ x: 0, y: 0, width: 660, height: 660 }, 1600, 660, desktop)).toMatch(/shape/);
  });

  it("accepts a frame inside the picture at the shape", () => {
    expect(frameProblem({ x: 0, y: 20, width: 1600, height: 640 }, 1600, 660, desktop)).toBeNull();
  });
});
