/**
 * Device pictures held for a styled run until Generate (ai-images Q43): what reached the library
 * becomes a reference, and only what did not stays held, so a second Generate never uploads a
 * picture twice. And the shape a run carries back to the browser (Q42).
 */
import { describe, expect, it } from "vitest";
import { settleHeldUpload } from "@/components/content/held-references";
import { isStyledAspect } from "@server/content/enhancement.types";

describe("settling an upload of held pictures", () => {
  it("makes every uploaded picture a reference and holds nothing when all arrived", () => {
    expect(settleHeldUpload(["a", "b"], ["https://media.test/a.webp", "https://media.test/b.webp"])).toEqual({
      uploaded: ["https://media.test/a.webp", "https://media.test/b.webp"],
      stillHeld: [],
    });
  });

  it("keeps only the pictures that failed, so trying again uploads those alone", () => {
    expect(settleHeldUpload(["a", "b", "c"], ["https://media.test/a.webp", undefined, "https://media.test/c.webp"])).toEqual({
      uploaded: ["https://media.test/a.webp", "https://media.test/c.webp"],
      stillHeld: ["b"],
    });
  });

  it("counts a picture that came back with no URL as not uploaded, never as silently dropped", () => {
    expect(settleHeldUpload(["a"], [""])).toEqual({ uploaded: [], stillHeld: ["a"] });
    expect(settleHeldUpload(["a"], [])).toEqual({ uploaded: [], stillHeld: ["a"] });
  });
});

describe("the shape a run carries", () => {
  it("is one of the four the modal offers, and nothing else", () => {
    for (const shape of ["1:1", "4:5", "9:16", "4:3"]) expect(isStyledAspect(shape)).toBe(true);
    for (const other of ["16:9", "", null, undefined, 1]) expect(isStyledAspect(other)).toBe(false);
  });
});
