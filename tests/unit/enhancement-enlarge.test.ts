/**
 * The `enlarge` tool on generated fixtures (image-enhancement spec R1 `enlarge`, A4; trd D2). A
 * plain resize with sharp and no service behind it, so what is asserted is arithmetic: the long
 * edge clears the target, the shape survives, the stored ceiling is never passed, and a photograph
 * that is already big enough is refused rather than proposed unchanged.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { ENLARGE_TARGET_LONG_EDGE } from "@server/content/channel-rules";
import { enlarge } from "@server/content/tools/enlarge";

const TARGET = ENLARGE_TARGET_LONG_EDGE;

/** A stand-in for a small shop photo: a plain ground with a product-shaped block on it. */
async function photo(width: number, height: number): Promise<Buffer> {
  const block = await sharp({
    create: {
      width: Math.round(width / 2),
      height: Math.round(height / 2),
      channels: 3,
      background: { r: 190, g: 60, b: 40 },
    },
  })
    .png()
    .toBuffer();
  return await sharp({ create: { width, height, channels: 3, background: { r: 230, g: 228, b: 224 } } })
    .composite([{ input: block, left: Math.round(width / 4), top: Math.round(height / 4) }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

const aspect = (width: number, height: number) => width / height;

describe("enlarge", () => {
  it("takes a 600px photograph past the target the channels ask for, and writes WebP", async () => {
    const result = await enlarge({ bytes: await photo(600, 450), targetLongEdge: TARGET });

    expect(result.mimeType).toBe("image/webp");
    const meta = await sharp(result.output).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([result.width, result.height]);
    expect(Math.max(result.width, result.height)).toBeGreaterThanOrEqual(TARGET);
  });

  it("keeps the shape, so nothing is stretched to reach the number", async () => {
    const landscape = await enlarge({ bytes: await photo(600, 450), targetLongEdge: TARGET });
    expect(aspect(landscape.width, landscape.height)).toBeCloseTo(aspect(600, 450), 2);

    const portrait = await enlarge({ bytes: await photo(450, 600), targetLongEdge: TARGET });
    expect(portrait.height).toBeGreaterThan(portrait.width);
    expect(aspect(portrait.width, portrait.height)).toBeCloseTo(aspect(450, 600), 2);
  });

  it("grows by the smallest whole factor that clears the target, never further", async () => {
    // 600 × 3 is the first whole multiple past 1600; × 2 would fall short at 1200.
    const result = await enlarge({ bytes: await photo(600, 450), targetLongEdge: 1600 });
    expect(Math.max(result.width, result.height)).toBe(1800);
  });

  it("never passes the stored ceiling, whatever the factor works out to", async () => {
    // 1100 × 2 is 2200, which is past what we keep (ADR-0026); the result stops at the ceiling.
    const result = await enlarge({ bytes: await photo(1100, 825), targetLongEdge: 1600 });
    expect(Math.max(result.width, result.height)).toBe(MAX_IMAGE_EDGE);
    expect(Math.max(result.width, result.height)).toBeGreaterThanOrEqual(1600);
    expect(aspect(result.width, result.height)).toBeCloseTo(aspect(1100, 825), 2);
  });

  it("refuses a photograph that is already large enough, rather than proposing one that changed nothing", async () => {
    const big = await photo(1600, 1200);
    await expect(enlarge({ bytes: big, targetLongEdge: TARGET })).rejects.toBeInstanceOf(DomainError);
    await expect(enlarge({ bytes: big, targetLongEdge: TARGET })).rejects.toThrow(
      "already 1600px on its long side",
    );
  });

  it("caps the target at the ceiling too, so no channel can ask for more than we keep", async () => {
    // Asking for 5000px on a 2048px photograph is asking for nothing we would store.
    await expect(
      enlarge({ bytes: await photo(MAX_IMAGE_EDGE, 1536), targetLongEdge: 5_000 }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("refuses bytes that are not a picture as a shown message, so the run fails rather than retries", async () => {
    await expect(enlarge({ bytes: Buffer.from("not an image"), targetLongEdge: TARGET })).rejects.toThrow(
      "This photo could not be read as an image",
    );
  });
});
