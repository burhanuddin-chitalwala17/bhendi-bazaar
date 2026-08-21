/**
 * A folder picker hands back everything the folder holds, not just the photos
 * (bulk-catalog-upload R2). `.DS_Store` counted as an image is how "48 files
 * selected" stops matching what the sheet can actually use.
 */
import { describe, it, expect } from "vitest";
import { imagesOnly, relativePath, sanitizePath } from "@/components/bulk-upload/files";

const file = (name: string, type: string, path?: string): File => {
  const f = new File(["x"], name.split("/").pop() as string, { type });
  Object.defineProperty(f, "webkitRelativePath", { value: path ?? "" });
  return f;
};
const asList = (files: File[]) => files as unknown as FileList;

describe("imagesOnly", () => {
  it("keeps photographs and drops the folder's junk", () => {
    const picked = imagesOnly(
      asList([
        file("front.jpg", "image/jpeg", "photos/abaya/front.jpg"),
        file(".DS_Store", "", "photos/abaya/.DS_Store"),
        file("Thumbs.db", "application/octet-stream", "photos/Thumbs.db"),
        file("price-list.pdf", "application/pdf", "photos/price-list.pdf"),
        file("back.png", "image/png", "photos/abaya/back.png"),
      ])
    );
    expect(picked.map((f) => f.name)).toEqual(["front.jpg", "back.png"]);
  });

  it("falls back to the extension when the browser reports no type", () => {
    const picked = imagesOnly(asList([file("a.webp", ""), file("notes.txt", "")]));
    expect(picked.map((f) => f.name)).toEqual(["a.webp"]);
  });

  it("an empty or absent selection is an empty list, not a crash", () => {
    expect(imagesOnly(null)).toEqual([]);
    expect(imagesOnly(asList([]))).toEqual([]);
  });
});

describe("relativePath", () => {
  it("prefers the folder path, falling back to the bare name", () => {
    expect(relativePath(file("front.jpg", "image/jpeg", "photos/abaya/front.jpg"))).toBe(
      "photos/abaya/front.jpg"
    );
    expect(relativePath(file("front.jpg", "image/jpeg"))).toBe("front.jpg");
  });
});

describe("sanitizePath", () => {
  it("sanitises each segment but keeps the folder structure", () => {
    expect(sanitizePath("Emerald Abaya/Front View.JPG")).toBe("emerald-abaya/front-view.jpg");
  });

  it("cannot climb out of its folder", () => {
    expect(sanitizePath("../../etc/passwd")).toBe("etc/passwd");
  });
});
