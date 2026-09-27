/**
 * The product in the result is the product we put there (image-enhancement spec R4, trd D4).
 *
 * Mutation-style on purpose: the interesting case is not "a completely different picture", it is
 * one channel of one pixel moved by one — the size of change a service that quietly re-rendered a
 * logo would make, and the size a tolerance would swallow. Nudging one byte must go red here, or
 * the check is decoration (docs/TESTING.md).
 *
 * The second half is the wiring: `white` and `studio` must actually run it, and must fail the run
 * rather than propose a product that changed. Deleting the call from either tool turns these red.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import type { Segmenter } from "@server/content/providers/segment";

const { guard } = vi.hoisted(() => ({ guard: vi.fn() }));
vi.mock("@server/content/tools/pixel-identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/content/tools/pixel-identity")>();
  guard.mockImplementation(actual.assertProductPixelsKept);
  return { assertProductPixelsKept: guard };
});

const { assertProductPixelsKept } = await import("@server/content/tools/pixel-identity");
const { onWhite } = await import("@server/content/tools/white");
const { inStudio } = await import("@server/content/tools/studio");

const PRODUCT = { r: 200, g: 30, b: 40, alpha: 1 };
const AT = { left: 12, top: 9 };
const source = { bytes: Buffer.from("the photograph"), objectKey: "products/org-1/a.webp", mimeType: "image/webp" };

/** A cut-out: an opaque block with a half-transparent fringe down one side, on nothing. */
async function cutout(): Promise<Buffer> {
  const block = await sharp({ create: { width: 20, height: 16, channels: 4, background: PRODUCT } }).png().toBuffer();
  const fringe = await sharp({ create: { width: 3, height: 16, channels: 4, background: { ...PRODUCT, alpha: 0.5 } } })
    .png()
    .toBuffer();
  return await sharp({ create: { width: 30, height: 24, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: block, left: 4, top: 4 },
      { input: fringe, left: 24, top: 4 },
    ])
    .png()
    .toBuffer();
}

/** The composite a tool would make: the cut-out placed on white, nothing else touched. */
async function composite(cut: Buffer): Promise<Buffer> {
  return await sharp({ create: { width: 60, height: 50, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: cut, left: AT.left, top: AT.top }])
    .removeAlpha()
    .png()
    .toBuffer();
}

/** One channel of one pixel, moved by one — the whole point of the exercise. */
async function nudge(bytes: Buffer, x: number, y: number, channel: number): Promise<Buffer> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels + channel;
  data[at] = data[at] === 255 ? 254 : data[at] + 1;
  return await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

function stubSegmenter(bytes: Buffer): Segmenter {
  return { key: ENHANCEMENT_PROVIDER.ZONE, isAvailable: () => true, cutOut: async () => bytes };
}

beforeEach(() => {
  guard.mockClear();
});

describe("assertProductPixelsKept", () => {
  it("passes a composite that placed the cut-out and changed nothing", async () => {
    const cut = await cutout();
    await expect(assertProductPixelsKept(cut, await composite(cut), AT)).resolves.toBeUndefined();
  });

  it("fails when one channel of one product pixel moves by one", async () => {
    const cut = await cutout();
    const changed = await nudge(await composite(cut), AT.left + 10, AT.top + 10, 1);
    await expect(assertProductPixelsKept(cut, changed, AT)).rejects.toBeInstanceOf(DomainError);
    await expect(assertProductPixelsKept(cut, changed, AT)).rejects.toThrow(/changed the product itself/);
  });

  it("compares only what was fully opaque, since a fringe was blended with the backdrop by design", async () => {
    const cut = await cutout();
    // Inside the half-transparent fringe: changed, and rightly not the product's business.
    const fringe = await nudge(await composite(cut), AT.left + 25, AT.top + 10, 0);
    await expect(assertProductPixelsKept(cut, fringe, AT)).resolves.toBeUndefined();
  });

  it("refuses a placement that would run the product off the picture", async () => {
    const cut = await cutout();
    const composed = await composite(cut);
    await expect(assertProductPixelsKept(cut, composed, { left: 45, top: 9 })).rejects.toThrow(/keep the product whole/);
    await expect(assertProductPixelsKept(cut, composed, { left: -1, top: 9 })).rejects.toThrow(/keep the product whole/);
  });
});

describe("the tools run it", () => {
  const fixture = async () =>
    stubSegmenter(
      await sharp({ create: { width: 200, height: 160, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
          {
            input: await sharp({ create: { width: 90, height: 70, channels: 4, background: PRODUCT } }).png().toBuffer(),
            left: 50,
            top: 40,
          },
        ])
        .png()
        .toBuffer(),
    );

  it("white checks the product it placed against the composite it made", async () => {
    await onWhite(source, await fixture());
    expect(guard).toHaveBeenCalledTimes(1);
    const [placed, composed, placement] = guard.mock.calls[0];
    expect((await sharp(placed).metadata()).hasAlpha).toBe(true);
    expect((await sharp(composed).metadata()).format).toBe("png");
    expect(placement.left).toBeGreaterThan(0);
  });

  it("studio does the same", async () => {
    await inStudio(source, await fixture());
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it("proposes nothing when the check refuses — the run fails instead", async () => {
    const refusal = new DomainError("The improvement changed the product itself, so it was not kept");
    guard.mockRejectedValueOnce(refusal);
    await expect(onWhite(source, await fixture())).rejects.toBe(refusal);
    guard.mockRejectedValueOnce(refusal);
    await expect(inStudio(source, await fixture())).rejects.toBe(refusal);
  });
});
