/**
 * Matching a sheet's image reference to one uploaded file
 * (bulk-catalog-upload R2). The case this exists for: two products each holding
 * their own `front.jpg`. Guessing between them puts the wrong photograph on the
 * wrong product silently, so an ambiguous reference must be an error.
 */
import { describe, it, expect } from "vitest";
import { matchImage, matchingPaths, imageMatchMessage } from "@server/catalog/bulk/image-match";

const FOLDERS = [
  "photos/emerald-abaya/front.jpg",
  "photos/emerald-abaya/back.jpg",
  "photos/rose-attar/front.jpg",
];

describe("matchImage", () => {
  it("matches a bare filename when only one file has it", () => {
    expect(matchImage("back.jpg", FOLDERS)).toEqual({
      path: "photos/emerald-abaya/back.jpg",
    });
  });

  it("refuses to guess when two products share a filename", () => {
    const result = matchImage("front.jpg", FOLDERS);
    expect(result).toMatchObject({ kind: "ambiguous" });
    if (!("kind" in result) || result.kind !== "ambiguous") throw new Error("expected ambiguity");
    expect(result.candidates).toHaveLength(2);
  });

  it("a folder-qualified reference resolves the ambiguity", () => {
    expect(matchImage("emerald-abaya/front.jpg", FOLDERS)).toEqual({
      path: "photos/emerald-abaya/front.jpg",
    });
    expect(matchImage("rose-attar/front.jpg", FOLDERS)).toEqual({
      path: "photos/rose-attar/front.jpg",
    });
  });

  it("does not require the sheet to know the upload's root folder", () => {
    // The user selected `photos/`, so every path carries it; the sheet does not.
    expect(matchImage("photos/emerald-abaya/back.jpg", FOLDERS)).toEqual({
      path: "photos/emerald-abaya/back.jpg",
    });
  });

  it("matches whole segments only — never a partial name", () => {
    expect(matchImage("t.jpg", ["photos/front.jpg"])).toMatchObject({ kind: "missing" });
    expect(matchImage("abaya/front.jpg", FOLDERS)).toMatchObject({ kind: "missing" });
  });

  it("is case-insensitive and tolerates Windows separators", () => {
    expect(matchImage("Emerald-Abaya/FRONT.JPG", FOLDERS)).toEqual({
      path: "photos/emerald-abaya/front.jpg",
    });
    expect(matchingPaths("back.jpg", ["photos\\emerald-abaya\\back.jpg"])).toEqual([
      "photos\\emerald-abaya\\back.jpg",
    ]);
  });

  it("reports missing and empty references rather than matching everything", () => {
    expect(matchImage("nope.jpg", FOLDERS)).toEqual({ kind: "missing" });
    expect(matchImage("   ", FOLDERS)).toEqual({ kind: "missing" });
  });

  it("the ambiguity message shows how to fix it", () => {
    const result = matchImage("front.jpg", FOLDERS);
    if (!("kind" in result)) throw new Error("expected a failure");
    const message = imageMatchMessage("front.jpg", result);
    expect(message).toContain("matches 2 uploaded files");
    expect(message).toContain("photos/emerald-abaya/front.jpg");
  });
});
