// The browser-direct bulk path re-encodes before upload (ADR-0026), which means the
// stored pathname has to describe the bytes rather than the file that was picked — a
// `.jpg` holding WebP is the kind of small lie that makes a later cleanup script wrong.
import { describe, expect, it } from "vitest";
import { storedPathFor } from "@/lib/image/downscale";

const webp = (name: string) => new File([], name, { type: "image/webp" });

describe("storedPathFor", () => {
  it("takes the uploaded file's extension", () => {
    expect(storedPathFor("shawls/red.jpg", webp("red.webp"))).toBe("shawls/red.webp");
  });

  it("appends one when the path had none, rather than leaving it bare", () => {
    expect(storedPathFor("shawls/red", webp("red.webp"))).toBe("shawls/red.webp");
  });

  it("does not mistake a dot in a directory for the file's extension", () => {
    expect(storedPathFor("v1.2/red", webp("red.webp"))).toBe("v1.2/red.webp");
  });

  it("leaves the path alone when the file itself has no extension to lend", () => {
    expect(storedPathFor("shawls/red.jpg", webp("red"))).toBe("shawls/red.jpg");
  });
});
