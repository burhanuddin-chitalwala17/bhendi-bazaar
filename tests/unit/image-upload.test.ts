import { describe, expect, it } from "vitest";
import {
  imageFileProblem,
  sanitizeIdentifier,
  MAX_IMAGE_BYTES,
} from "@server/catalog/image-upload";

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
