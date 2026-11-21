/**
 * A marketplace's main image is never AI-made (ai-images/improve-with-ai R11, A6; ADR-0077): an AI
 * picture moves behind the first real photograph, and a listing with only AI pictures is refused.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@server/content/renditions.service", () => ({ renditionUrl: vi.fn() }));
const { AI_ONLY_PHOTOS_MESSAGE, mainImageFirst, marketplacePhotoUrls } = await import("@server/channels/listing-photos-out");

const real = (ref: string) => ({ ref, assetId: ref, asset: { mimeType: "image/jpeg", transform: null } });
const ai = (ref: string) => ({ ref, assetId: ref, asset: { mimeType: "image/jpeg", transform: { tool: "STYLED" } } });

describe("the main image", () => {
  it("is the first real photograph when an AI picture was first", async () => {
    const media = [ai("a"), real("b"), real("c")];
    await expect(marketplacePhotoUrls("org-1", media, ["a", "b", "c"], [])).resolves.toEqual(["b", "a", "c"]);
  });

  it("leaves an order that already starts with a real photograph alone", () => {
    expect(mainImageFirst([real("a"), ai("b")]).map((p) => p.ref)).toEqual(["a", "b"]);
  });

  it("refuses a listing whose every photo is AI-made", () => {
    expect(() => mainImageFirst([ai("a"), ai("b")])).toThrow(AI_ONLY_PHOTOS_MESSAGE);
  });

  it("keeps an AI picture's derivative AI-made — an enlargement cannot become the main image (review)", () => {
    const enlarged = { ...real("e"), asset: { mimeType: null, transform: { tool: "ENLARGE", aiMade: true } } };
    expect(() => mainImageFirst([enlarged])).toThrow(AI_ONLY_PHOTOS_MESSAGE);
  });

  it("treats a crop or another tool's result as a real photograph", () => {
    expect(mainImageFirst([{ ...real("a"), asset: { mimeType: null, transform: { tool: "WHITE" } } }]).map((p) => p.ref)).toEqual(["a"]);
  });
});
