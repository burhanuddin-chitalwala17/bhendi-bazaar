/** What a message fact becomes in a thread (social-selling inbox-core D2, R8); pure. */
import { describe, expect, it } from "vitest";
import type { FactOf } from "@server/shared/social-events/facts";
import { messageRows, NAMED_LINE, previewOf } from "@server/inbox/message-rows";

const fact = (over: Partial<FactOf<"inbound-message">>): FactOf<"inbound-message"> => ({
  kind: "inbound-message", key: "k", connectionId: "c", platform: "instagram", occurredAt: new Date(0),
  personKey: "p", personScopedId: null, personName: null, personHandle: null, personPhone: null,
  messageId: "m", messageKind: "text", text: null, attachments: [], replyTo: null, buttonPayload: null,
  storyRef: null, productRetailerId: null, referral: null, unsupportedLabel: null, coordinates: null, ...over,
});
const file = (ref: string, caption: string | null = null) => ({ ref, mimeType: null, caption, fileName: null });

describe("messageRows", () => {
  it("A4: a voice note is audio carrying its file, to play in the thread", () => {
    expect(messageRows(fact({ messageKind: "audio", attachments: [file("v1")] }))).toEqual([
      { part: "", kind: "AUDIO", label: null, text: null, attachmentRef: "v1" },
    ]);
  });

  it("A4: what cannot be shown is a line naming what it was, never dropped", () => {
    expect(messageRows(fact({ messageKind: "unsupported", unsupportedLabel: "A poll" }))[0]).toMatchObject({ kind: "UNSUPPORTED", label: "A poll" });
    expect(messageRows(fact({ messageKind: "unsupported" }))[0].label).toBe(NAMED_LINE.UNKNOWN);
    expect(messageRows(fact({ messageKind: "share", attachments: [file("https://x")] }))).toEqual([
      { part: "", kind: "UNSUPPORTED", label: NAMED_LINE.SHARE, text: null, attachmentRef: null },
    ]);
    expect(messageRows(fact({ messageKind: "contacts" }))[0].label).toBe(NAMED_LINE.CONTACTS);
  });

  it("several photos in one message are one row each, the text on the first, captions on their own", () => {
    const rows = messageRows(fact({ messageKind: "image", text: "these two", attachments: [file("a"), file("b", "the red one")] }));
    expect(rows.map((r) => [r.part, r.attachmentRef, r.text])).toEqual([["", "a", "these two"], ["#2", "b", "the red one"]]);
  });

  it("a button tap and a story reply read as text", () => {
    expect(messageRows(fact({ messageKind: "button", text: "Yes" }))[0]).toMatchObject({ kind: "TEXT", text: "Yes" });
    expect(messageRows(fact({ messageKind: "story-reply", text: "love it" }))[0]).toMatchObject({ kind: "TEXT", text: "love it" });
  });
});

describe("previewOf", () => {
  it("flattens and cuts, and names nothing for an empty text", () => {
    expect(previewOf("  a\n\nb ", 10)).toBe("a b");
    expect(previewOf("abcdefghijkl", 5)).toBe("abcd…");
    expect(previewOf(null, 5)).toBeNull();
    expect(previewOf("   ", 5)).toBeNull();
  });
});
