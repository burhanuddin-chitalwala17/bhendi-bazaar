/**
 * The three tools that need something cut out (image-enhancement spec R1, A2; trd D2, D4), run over
 * generated fixtures with a stub segmenter — sharp itself does the work, and no service is called.
 * What is asserted is what a marketplace checks: a square, a background that is exactly white, a
 * backdrop that is the declared gradient, and a product that came through unchanged.
 */
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import type { Segmenter } from "@server/content/providers/segment";
import {
  CONTENT_RATIO,
  PRODUCT_MARGIN_RATIO,
  STUDIO_GRADIENT_BOTTOM,
  STUDIO_GRADIENT_TOP,
} from "@server/content/tools/backdrop";
import { cutOut, cutOutProduct } from "@server/content/tools/cutout";
import { onWhite } from "@server/content/tools/white";
import { inStudio } from "@server/content/tools/studio";

const PRODUCT = { r: 200, g: 30, b: 40 };
/** The product's colour survives the composite exactly; WebP then moves it by a hair. */
const ENCODER_SLACK = 6;
/** WebP rings around the sharp edge of the product; the background is read well clear of it. */
const RINGING_PX = 8;

const source = { bytes: Buffer.from("the photograph"), objectKey: "products/org-1/a.webp", mimeType: "image/webp" };

/** A cut-out as a service would hand one back: a block of product on nothing at all. */
async function cutOutFixture(
  canvas: { width: number; height: number },
  block: { left: number; top: number; width: number; height: number },
): Promise<Buffer> {
  const product = await sharp({
    create: { width: block.width, height: block.height, channels: 4, background: { ...PRODUCT, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return await sharp({
    create: { ...canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: product, left: block.left, top: block.top }])
    .png()
    .toBuffer();
}

function stubSegmenter(bytes: Buffer): Segmenter {
  return { key: ENHANCEMENT_PROVIDER.ZONE, isAvailable: () => true, cutOut: vi.fn().mockResolvedValue(bytes) };
}

async function pixels(bytes: Buffer) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    at: (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)],
  };
}

const near = (got: number[], want: { r: number; g: number; b: number }, slack: number) =>
  Math.abs(got[0] - want.r) <= slack && Math.abs(got[1] - want.g) <= slack && Math.abs(got[2] - want.b) <= slack;

describe("cutOut", () => {
  it("trims to the product with an even margin and keeps the transparency that is the result", async () => {
    const fixture = await cutOutFixture({ width: 400, height: 320 }, { left: 120, top: 90, width: 200, height: 150 });
    const result = await cutOut(source, stubSegmenter(fixture));

    expect(result.mimeType).toBe("image/png");
    const meta = await sharp(result.output).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);

    // The margin is even: the same number of empty pixels on each side of the block.
    const map = await pixels(result.output);
    expect(map.width - 200).toBe(map.height - 150);
    expect(map.width).toBeGreaterThan(200);
    expect(map.at(0, 0)[3], "the corner is still nothing at all").toBe(0);
    expect(map.at(Math.round(map.width / 2), Math.round(map.height / 2)).slice(0, 3)).toEqual([
      PRODUCT.r,
      PRODUCT.g,
      PRODUCT.b,
    ]);
  });

  it("passes the photograph straight to the service, bytes and key together", async () => {
    const segmenter = stubSegmenter(await cutOutFixture({ width: 80, height: 60 }, { left: 20, top: 15, width: 30, height: 20 }));
    await cutOut(source, segmenter);
    expect(segmenter.cutOut).toHaveBeenCalledWith(source);
  });

  it("never comes back larger than the stored ceiling", async () => {
    const wide = await cutOutFixture({ width: 2400, height: 300 }, { left: 10, top: 50, width: 2380, height: 200 });
    const result = await cutOutProduct(source, stubSegmenter(wide));
    expect(result.width).toBe(MAX_IMAGE_EDGE);
    expect(result.height).toBeLessThan(MAX_IMAGE_EDGE);
  });

  it("says so when the service kept nothing, rather than proposing an empty picture", async () => {
    const empty = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    await expect(cutOut(source, stubSegmenter(empty))).rejects.toBeInstanceOf(DomainError);
    await expect(cutOut(source, stubSegmenter(empty))).rejects.toThrow(/No product could be found/);
  });

  it("treats bytes that are not a picture as the org member's problem, not the queue's", async () => {
    await expect(cutOut(source, stubSegmenter(Buffer.from("not a png")))).rejects.toBeInstanceOf(DomainError);
  });
});

describe("onWhite", () => {
  it("makes a square on RGB 255,255,255 with the product centred and unchanged", async () => {
    const fixture = await cutOutFixture({ width: 400, height: 320 }, { left: 120, top: 90, width: 200, height: 150 });
    const result = await onWhite(source, stubSegmenter(fixture));

    expect(result.mimeType).toBe("image/webp");
    expect((await sharp(result.output).metadata()).format).toBe("webp");
    expect(result.width, "square").toBe(result.height);

    const map = await pixels(result.output);
    expect(map.width).toBe(result.width);
    for (const [x, y] of [
      [0, 0],
      [map.width - 1, 0],
      [0, map.height - 1],
      [map.width - 1, map.height - 1],
    ]) {
      expect(map.at(x, y).slice(0, 3), `corner ${x},${y}`).toEqual([255, 255, 255]);
    }
    // Exact through the composite, within the encoder's hair afterwards — which is the whole
    // reason the identity check runs before the WebP and not on it (trd D4).
    expect(near(map.at(Math.round(map.width / 2), Math.round(map.height / 2)), PRODUCT, ENCODER_SLACK)).toBe(true);
  });

  it("leaves the declared margin of white all round the product", async () => {
    const fixture = await cutOutFixture({ width: 400, height: 320 }, { left: 120, top: 90, width: 200, height: 150 });
    const result = await onWhite(source, stubSegmenter(fixture));
    const map = await pixels(result.output);

    // The band the margin promises is white to the byte, read clear of the encoder's ringing.
    const band = Math.floor(map.width * PRODUCT_MARGIN_RATIO) - RINGING_PX;
    expect(band).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const inBand = x < band || y < band || x >= map.width - band || y >= map.height - band;
        if (!inBand) continue;
        const [r, g, b] = map.at(x, y);
        if (r !== 255 || g !== 255 || b !== 255) offenders.push(`${x},${y} = ${r},${g},${b}`);
      }
    }
    expect(offenders.slice(0, 5), "the background is not pure white").toEqual([]);
    expect(CONTENT_RATIO).toBeCloseTo(1 - 2 * PRODUCT_MARGIN_RATIO, 10);
  });

  it("keeps the product's own colour rather than repainting it", async () => {
    const fixture = await cutOutFixture({ width: 300, height: 300 }, { left: 50, top: 50, width: 100, height: 200 });
    const result = await onWhite(source, stubSegmenter(fixture));
    const map = await pixels(result.output);
    expect(near(map.at(Math.round(map.width / 2), Math.round(map.height / 2)), PRODUCT, ENCODER_SLACK)).toBe(true);
  });
});

describe("inStudio", () => {
  it("is a square whose corners are the declared gradient, top stop above and bottom stop below", async () => {
    const fixture = await cutOutFixture({ width: 400, height: 320 }, { left: 120, top: 90, width: 200, height: 150 });
    const result = await inStudio(source, stubSegmenter(fixture));

    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(result.height);
    const map = await pixels(result.output);
    expect(near(map.at(0, 0), STUDIO_GRADIENT_TOP, ENCODER_SLACK), "top-left").toBe(true);
    expect(near(map.at(map.width - 1, 0), STUDIO_GRADIENT_TOP, ENCODER_SLACK), "top-right").toBe(true);
    expect(near(map.at(0, map.height - 1), STUDIO_GRADIENT_BOTTOM, ENCODER_SLACK), "bottom-left").toBe(true);
    expect(near(map.at(map.width - 1, map.height - 1), STUDIO_GRADIENT_BOTTOM, ENCODER_SLACK), "bottom-right").toBe(true);
  });

  it("lays a shadow under the product, darker than the backdrop at the same height", async () => {
    const fixture = await cutOutFixture({ width: 400, height: 320 }, { left: 120, top: 90, width: 200, height: 150 });
    const result = await inStudio(source, stubSegmenter(fixture));
    const map = await pixels(result.output);

    // Find where the product actually ends, then read the rows below it against the far edge of
    // the same row — a vertical gradient is flat across a row, so any difference is the shadow.
    const centre = Math.round(map.width / 2);
    let base = 0;
    for (let y = 0; y < map.height; y += 1) if (near(map.at(centre, y), PRODUCT, ENCODER_SLACK)) base = y;

    const darkened = [];
    for (let y = base + 1; y < Math.min(map.height, base + 12); y += 1) {
      darkened.push(map.at(centre, y)[0] < map.at(1, y)[0]);
    }
    expect(darkened.length).toBeGreaterThan(5);
    expect(darkened.every(Boolean), "no shadow under the product").toBe(true);
  });

  it("keeps the product itself out of the backdrop's way", async () => {
    const fixture = await cutOutFixture({ width: 300, height: 300 }, { left: 60, top: 60, width: 180, height: 180 });
    const result = await inStudio(source, stubSegmenter(fixture));
    const map = await pixels(result.output);
    expect(near(map.at(Math.round(map.width / 2), Math.round(map.height / 2)), PRODUCT, ENCODER_SLACK)).toBe(true);
  });
});
