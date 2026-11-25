/** What a draft save accepts (social-selling/post-composer D1, D3; spec R2, R4, R6). */
import { describe, expect, it } from "vitest";
import { postDraftSaveSchema, postDraftSchema } from "@/lib/validation/schemas/post.schema";

const ids = (n: number, prefix = "id") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("post draft schema", () => {
  it("saves a caption over Instagram's 2,200 characters and 30 hashtags: the field says so, schedule refuses (spec R4)", () => {
    const caption = `${"#tag ".repeat(40)}${"x".repeat(2_300)}`;
    expect(postDraftSchema.parse({ caption }).caption).toBe(caption);
  });

  it("takes up to 10 pictures and 10 products, each once (spec R2, R6)", () => {
    expect(postDraftSchema.safeParse({ mediaIds: ids(10), productIds: ids(10) }).success).toBe(true);
    expect(postDraftSchema.safeParse({ productIds: ids(11) }).success).toBe(false);
    expect(postDraftSchema.safeParse({ mediaIds: ids(11) }).success).toBe(false);
    expect(postDraftSchema.safeParse({ productIds: ["a", "a"] }).success).toBe(false);
    expect(postDraftSchema.safeParse({ mediaIds: ["a", "a"] }).success).toBe(false);
  });

  it("takes only the known destinations, each once (Q4)", () => {
    expect(postDraftSchema.parse({ destinations: ["IG_FEED", "IG_STORY", "WA_STATUS"] }).destinations).toHaveLength(3);
    expect(postDraftSchema.safeParse({ destinations: ["FB_PAGE"] }).success).toBe(false);
    expect(postDraftSchema.safeParse({ destinations: ["IG_FEED", "IG_FEED"] }).success).toBe(false);
  });

  it("drops server-owned fields and needs the version on a save (Invariant 4, D3)", () => {
    const parsed = postDraftSaveSchema.parse({ version: 2, state: "DONE", scheduledAt: "2026-12-01", orgId: "x" });
    expect(parsed).toEqual({ version: 2, caption: "", mediaIds: [], productIds: [], destinations: [] });
    expect(postDraftSaveSchema.safeParse({}).success).toBe(false);
  });
});
