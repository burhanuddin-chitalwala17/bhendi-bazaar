import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeImage } from "@server/catalog/image-upload";
import {
  buildImagePath,
  imageFileProblem,
  normalizedName,
  sanitizeIdentifier,
  MAX_IMAGE_BYTES,
} from "@server/catalog/image-paths";
import { ORG_CODE_PATTERN, orgCodeCandidates } from "@server/catalog/org.code";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";

describe("imageFileProblem", () => {
  it("accepts every allowed image type", () => {
    for (const type of ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]) {
      expect(imageFileProblem({ name: "a.img", type, size: 1000 })).toBeNull();
    }
  });

  it("rejects a non-image type, naming the file", () => {
    const problem = imageFileProblem({ name: "run.exe", type: "application/octet-stream", size: 10 });
    expect(problem).toContain("run.exe");
    expect(problem).toContain("Invalid file type");
  });

  it("rejects an SVG — scriptable, so never an allowed upload", () => {
    expect(imageFileProblem({ name: "a.svg", type: "image/svg+xml", size: 10 })).not.toBeNull();
  });

  it("accepts a file exactly at the size limit and rejects one byte over", () => {
    expect(imageFileProblem({ name: "a.png", type: "image/png", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(imageFileProblem({ name: "a.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toContain(
      "too large"
    );
  });
});

describe("sanitizeIdentifier", () => {
  it("kebab-cases and strips unsafe characters", () => {
    expect(sanitizeIdentifier("Kashmiri Shawl #7!")).toBe("kashmiri-shawl-7");
    expect(sanitizeIdentifier("Plain Kurta")).toBe("plain-kurta");
  });

  it("falls back to 'unnamed' when nothing usable remains", () => {
    expect(sanitizeIdentifier(null)).toBe("unnamed");
    expect(sanitizeIdentifier(undefined)).toBe("unnamed");
    expect(sanitizeIdentifier("!!!")).toBe("unnamed");
  });

  it("caps at 50 characters", () => {
    expect(sanitizeIdentifier("a".repeat(80)).length).toBe(50);
  });
});

describe("normalizedName", () => {
  it("swaps the extension for the one the bytes actually have", () => {
    expect(normalizedName("shawl.JPG", "webp")).toBe("shawl.webp");
    expect(normalizedName("a.b.png", "webp")).toBe("a.b.webp");
  });

  it("adds one when the picked file had none", () => {
    expect(normalizedName("shawl", "webp")).toBe("shawl.webp");
  });
});

// The leak this closes: a phone original stored at full size is re-served at full size
// on every fetch, whatever the slot it is painted into (ADR-0026).
describe("normalizeImage", () => {
  async function png(width: number, height: number): Promise<File> {
    const body = await sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } },
    })
      .png()
      .toBuffer();
    return new File([new Uint8Array(body)], "original.png", { type: "image/png" });
  }

  it("caps the longest edge and re-encodes as WebP", async () => {
    const { body, extension, contentType } = await normalizeImage(await png(3000, 2000));
    expect(extension).toBe("webp");
    expect(contentType).toBe("image/webp");

    const meta = await sharp(body).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(MAX_IMAGE_EDGE);
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
  });

  it("leaves an already-small image's dimensions alone rather than enlarging it", async () => {
    const { body } = await normalizeImage(await png(400, 300));
    const meta = await sharp(body).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("refuses a file no decoder accepts, as a shown message rather than a 500", async () => {
    const notAnImage = new File([new TextEncoder().encode("this is not a picture")], "x.png", {
      type: "image/png",
    });
    await expect(normalizeImage(notAnImage)).rejects.toThrow(/Could not read image: x\.png/);
  });
});

describe("buildImagePath agrees with the presign route's prefix", () => {
  /**
   * The product gallery builds its path in the browser and the presign route checks it
   * against `products/<org.code.toLowerCase()>/`. The two use different functions to
   * reach the same segment, so a code shape that sanitizes differently from lowercasing
   * would refuse every upload from the page that was just converted to use it.
   */
  const prefixFor = (orgCode: string) => `products/${orgCode.toLowerCase()}/`;

  it("holds for generated org codes", () => {
    const codes = orgCodeCandidates();
    for (let i = 0; i < 50; i++) {
      const code = codes.next().value as string;
      expect(code).toMatch(ORG_CODE_PATTERN);
      const prefix = prefixFor(code);
      const path = buildImagePath("products", "front.webp", "Silk Abaya", code);
      expect(path.slice(0, prefix.length)).toBe(prefix);
    }
  });

  it("holds for the legacy SEL- codes the generator no longer issues", () => {
    const prefix = prefixFor("SEL-1234");
    const path = buildImagePath("products", "front.webp", "Silk Abaya", "SEL-1234");
    expect(path.slice(0, prefix.length)).toBe(prefix);
  });
});
