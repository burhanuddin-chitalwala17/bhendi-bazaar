/**
 * The `light` tool on a generated dark photograph (image-enhancement spec R1, A1; trd D2): the
 * mean luminance rises, the picture keeps its size, the result is WebP at the stored quality, and
 * the same bytes in give the same bytes out — which is what lets a resumed run propose the same
 * file. sharp itself runs here; there is no provider to stub.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { LIGHT_GAMMA, lightFix } from "@server/content/tools/light";
import { DomainError } from "@server/shared/domain-error";

/** The average grey level across the picture, 0–255. */
async function meanLuminance(bytes: Buffer): Promise<number> {
  const { data } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const value of data) sum += value;
  return sum / data.length;
}

/** A dark stand-in for a shop photo: a near-black ground with a dim product-shaped block on it. */
async function darkFixture(): Promise<Buffer> {
  const block = await sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 70, g: 60, b: 50 } } }).png().toBuffer();
  return await sharp({ create: { width: 200, height: 160, channels: 3, background: { r: 18, g: 20, b: 24 } } })
    .composite([{ input: block, left: 60, top: 50 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("lightFix", () => {
  it("brightens a dark photograph without changing its size, and writes WebP", async () => {
    const source = await darkFixture();
    const before = await meanLuminance(source);

    const result = await lightFix(source);

    expect(result.mimeType).toBe("image/webp");
    const meta = await sharp(result.output).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([200, 160]);
    expect([result.width, result.height]).toEqual([200, 160]);
    expect(await meanLuminance(result.output)).toBeGreaterThan(before);
  });

  it("is deterministic — the same bytes in, the same bytes out", async () => {
    const source = await darkFixture();
    const [first, second] = await Promise.all([lightFix(source), lightFix(source)]);
    expect(Buffer.compare(first.output, second.output)).toBe(0);
  });

  it("copes with a flat picture, where there is no range to stretch", async () => {
    const flat = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 30, g: 30, b: 30 } } }).png().toBuffer();
    const result = await lightFix(flat);
    expect((await sharp(result.output).metadata()).format).toBe("webp");
  });

  it("keeps the lift gentle, as the TRD asks", () => {
    expect(LIGHT_GAMMA).toBeGreaterThanOrEqual(1.1);
    expect(LIGHT_GAMMA).toBeLessThanOrEqual(1.2);
  });

  it("refuses bytes that are not a picture as a shown message, so the run fails rather than retries", async () => {
    await expect(lightFix(Buffer.from("not an image"))).rejects.toBeInstanceOf(DomainError);
    await expect(lightFix(Buffer.from("not an image"))).rejects.toThrow("This photo could not be read as an image");
  });
});
