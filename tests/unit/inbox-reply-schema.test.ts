/** A member's reply as the server takes it (social-selling inbox-core D6; R5, Q5). */
import { describe, expect, it } from "vitest";
import { replySchema } from "@/lib/validation/schemas/inbox-reply.schema";

const clientId = "4b7c6a52-0c1e-4c5e-9f1a-2d3b4c5d6e7f";

describe("replySchema", () => {
  it("R5: takes text up to 1,000 characters and refuses one more", () => {
    expect(replySchema.safeParse({ clientId, text: "a".repeat(1000) }).success).toBe(true);
    expect(replySchema.safeParse({ clientId, text: "a".repeat(1001) }).success).toBe(false);
  });

  it("Q5: a picture alone is a reply; an empty box is not", () => {
    expect(replySchema.safeParse({ clientId, text: "", mediaId: "asset-1" }).success).toBe(true);
    expect(replySchema.safeParse({ clientId, text: "   " }).success).toBe(false);
  });

  it("D6: a reply carries the box's client id, so a double tap sends once", () => {
    expect(replySchema.safeParse({ text: "hi" }).success).toBe(false);
    expect(replySchema.safeParse({ clientId: "not-a-uuid", text: "hi" }).success).toBe(false);
  });

  it("Invariant 4: fields the server owns are dropped", () => {
    const parsed = replySchema.parse({ clientId, text: "hi", state: "SENT", memberId: "someone", author: "AUTOMATIC" });
    expect(parsed).toEqual({ clientId, text: "hi" });
  });
});
