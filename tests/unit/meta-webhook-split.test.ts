import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { splitWebhook } from "@server/channels/providers/meta/webhook-split";
import { sameToken, verifyMetaSignature } from "@server/channels/providers/meta/signature";
import { SOCIAL_PLATFORM } from "@server/channels/social/types";

/** meta-foundation unit 2: Meta's envelope split into items stored once, and the signature check (D3, D12). */

const NOW = new Date("2026-11-24T10:00:00Z");

const whatsappDelivery = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA1",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "919800000000", phone_number_id: "PHONE1" },
            contacts: [{ profile: { name: "Ayesha" }, wa_id: "919811111111" }],
            messages: [
              { id: "wamid.A", from: "919811111111", timestamp: "1764000000", type: "text", text: { body: "hi" } },
              { id: "wamid.B", from: "919811111111", timestamp: "1764000005", type: "text", text: { body: "price?" } },
            ],
            statuses: [{ id: "wamid.OUT", status: "delivered", timestamp: "1764000010", recipient_id: "919811111111" }],
          },
        },
        { field: "account_update", value: { event: "PARTNER_REMOVED" } },
      ],
    },
  ],
};

const instagramDelivery = {
  object: "instagram",
  entry: [
    {
      id: "IG1",
      time: 1764000000000,
      messaging: [
        { sender: { id: "PSID1" }, recipient: { id: "IG1" }, timestamp: 1764000001000, message: { mid: "m_1", text: "hello" } },
        { sender: { id: "PSID1" }, recipient: { id: "IG1" }, timestamp: 1764000002000, read: { mid: "m_0" } },
      ],
      changes: [{ field: "comments", value: { id: "C1", text: "SHOP", from: { id: "U1" }, media: { id: "M1" } } }],
    },
  ],
};

describe("splitting a WhatsApp delivery", () => {
  const items = splitWebhook(SOCIAL_PLATFORM.WHATSAPP, whatsappDelivery, NOW)!;

  it("gives each message and status its own item, keyed by Meta's id (spec A1)", () => {
    expect(items.map((item) => item.dedupeKey)).toEqual([
      "whatsapp:WABA1:PHONE1:msg:wamid.A",
      "whatsapp:WABA1:PHONE1:msg:wamid.B",
      "whatsapp:WABA1:PHONE1:status:wamid.OUT:delivered",
      expect.stringMatching(/^whatsapp:WABA1:WABA1:account_update:h:[0-9a-f]{64}$/),
    ]);
  });

  it("routes a message by its phone number only, an account change by the business account", () => {
    expect(items[0].route).toEqual({ kind: "phone", id: "PHONE1" });
    expect(items[3].route).toEqual({ kind: "business", id: "WABA1" });
  });

  it("keys the same account-level change differently for two accounts", () => {
    const other = JSON.parse(JSON.stringify(whatsappDelivery));
    other.entry[0].id = "WABA2";
    expect(splitWebhook(SOCIAL_PLATFORM.WHATSAPP, other, NOW)![3].dedupeKey).not.toBe(items[3].dedupeKey);
  });

  it("reads Meta's seconds as the time it happened", () => {
    expect(items[0].occurredAt.toISOString()).toBe(new Date(1764000000 * 1000).toISOString());
  });

  it("keeps the sender's profile with each message", () => {
    expect(items[0].payload).toMatchObject({ contacts: [{ profile: { name: "Ayesha" } }], message: { id: "wamid.A" } });
  });

  it("hashes an unkeyed change the same way every time, whatever the key order", () => {
    const reordered = JSON.parse(JSON.stringify(whatsappDelivery));
    reordered.entry[0].changes[1].value = { event: "PARTNER_REMOVED" };
    expect(splitWebhook(SOCIAL_PLATFORM.WHATSAPP, reordered, NOW)![3].dedupeKey).toBe(items[3].dedupeKey);
  });
});

describe("splitting an Instagram delivery", () => {
  const items = splitWebhook(SOCIAL_PLATFORM.INSTAGRAM, instagramDelivery, NOW)!;

  it("keys a message by its mid, a read by reader and mid, a comment by its id (spec A1)", () => {
    expect(items.map((item) => [item.field, item.dedupeKey])).toEqual([
      ["messaging.message", "instagram:IG1:mid:m_1"],
      ["messaging.read", "instagram:IG1:read:PSID1:m_0"],
      ["comments", "instagram:IG1:comment:C1"],
    ]);
  });

  it("one message between two shops is an event for each (the echo and the receipt)", () => {
    const copy = JSON.parse(JSON.stringify(instagramDelivery));
    copy.entry[0].id = "IG2";
    expect(splitWebhook(SOCIAL_PLATFORM.INSTAGRAM, copy, NOW)![0].dedupeKey).toBe("instagram:IG2:mid:m_1");
  });

  it("react, unreact, react again with the same emoji are three events", () => {
    const reaction = (action: string, timestamp: number) => ({
      sender: { id: "PSID1" },
      recipient: { id: "IG1" },
      timestamp,
      reaction: { mid: "m_1", action, reaction: "love" },
    });
    const body = { object: "instagram", entry: [{ id: "IG1", messaging: [reaction("react", 1), reaction("unreact", 2), reaction("react", 3)] }] };
    const keys = splitWebhook(SOCIAL_PLATFORM.INSTAGRAM, body, NOW)!.map((item) => item.dedupeKey);
    expect(new Set(keys).size).toBe(3);
  });

  it("reads Instagram's milliseconds", () => {
    expect(items[0].occurredAt.getTime()).toBe(1764000001000);
  });
});

describe("an envelope that is not the product's", () => {
  it("answers null, so it is counted and never stored", () => {
    expect(splitWebhook(SOCIAL_PLATFORM.INSTAGRAM, whatsappDelivery, NOW)).toBeNull();
    expect(splitWebhook(SOCIAL_PLATFORM.WHATSAPP, { nonsense: true }, NOW)).toBeNull();
    expect(splitWebhook(SOCIAL_PLATFORM.WHATSAPP, undefined, NOW)).toBeNull();
  });
});

describe("Meta's signature (spec A2, D12)", () => {
  const raw = Buffer.from(JSON.stringify(whatsappDelivery));
  const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

  it("accepts the current secret", () => {
    expect(verifyMetaSignature(raw, sign("current"), ["current", "previous"])).toEqual({ valid: true, previousSecret: false });
  });

  it("accepts the previous secret only while it is listed, and says so", () => {
    expect(verifyMetaSignature(raw, sign("previous"), ["current", "previous"])).toEqual({ valid: true, previousSecret: true });
    expect(verifyMetaSignature(raw, sign("previous"), ["current"])).toEqual({ valid: false });
  });

  it("refuses a wrong, missing, truncated or other-algorithm signature", () => {
    expect(verifyMetaSignature(raw, sign("other"), ["current"]).valid).toBe(false);
    expect(verifyMetaSignature(raw, null, ["current"]).valid).toBe(false);
    expect(verifyMetaSignature(raw, sign("current").slice(0, 40), ["current"]).valid).toBe(false);
    const sha1 = `sha1=${createHmac("sha1", "current").update(raw).digest("hex")}`;
    expect(verifyMetaSignature(raw, sha1, ["current"]).valid).toBe(false);
  });

  it("refuses a body changed after signing", () => {
    expect(verifyMetaSignature(Buffer.concat([raw, Buffer.from(" ")]), sign("current"), ["current"]).valid).toBe(false);
  });

  it("checks the bytes as received, even ones no text decoder can read", () => {
    const bytes = Buffer.concat([raw, Buffer.from([0xc3, 0x28])]);
    const signature = `sha256=${createHmac("sha256", "current").update(bytes).digest("hex")}`;
    expect(verifyMetaSignature(bytes, signature, ["current"]).valid).toBe(true);
    const decodedAgain = Buffer.from(new TextDecoder().decode(bytes));
    expect(verifyMetaSignature(decodedAgain, signature, ["current"]).valid).toBe(false);
  });

  it("compares the verify token exactly", () => {
    expect(sameToken("token-abc", "token-abc")).toBe(true);
    expect(sameToken("token-abd", "token-abc")).toBe(false);
    expect(sameToken(null, "token-abc")).toBe(false);
  });
});
