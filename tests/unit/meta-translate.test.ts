import { describe, expect, it } from "vitest";
import { translateEvent, type StoredEvent } from "@server/channels/providers/meta/translate";
import { FACT_KIND, MESSAGE_KIND, socialFact } from "@server/shared/social-events/facts";

/** meta-foundation unit 3: Meta's payloads into our facts (D4, R4: no tool sees a Meta payload). */

const AT = new Date("2026-11-24T10:00:00Z");
const whatsapp = (field: string, payload: unknown, key = "k1"): StoredEvent => ({ key, connectionId: "c1", product: "whatsapp", field, occurredAt: AT, payload });
const instagram = (field: string, payload: unknown, key = "k1"): StoredEvent => ({ key, connectionId: "c1", product: "instagram", field, occurredAt: AT, payload });

const contacts = [{ profile: { name: "Ayesha" }, wa_id: "919811111111" }];

describe("WhatsApp into facts", () => {
  it("a text message names its sender and number, and parses as a fact", () => {
    const [fact] = translateEvent(whatsapp("messages", { contacts, message: { id: "wamid.A", from: "919811111111", type: "text", text: { body: "hi" } } }));
    expect(fact).toMatchObject({ kind: FACT_KIND.INBOUND_MESSAGE, messageKind: MESSAGE_KIND.TEXT, text: "hi", personKey: "919811111111", personName: "Ayesha", personPhone: "+919811111111" });
    expect(socialFact.safeParse(fact).success).toBe(true);
  });

  it("prefers the business-scoped id as the person's key when Meta gives one", () => {
    const [fact] = translateEvent(whatsapp("messages", { contacts: [], message: { id: "w", from: "u.handle", user_id: "BSUID1", type: "text", text: { body: "x" } } }));
    expect(fact).toMatchObject({ personKey: "BSUID1", personScopedId: "BSUID1", personPhone: null });
  });

  it("a voice note is audio with Meta's media id, never a URL", () => {
    const [fact] = translateEvent(whatsapp("messages", { contacts, message: { id: "w", from: "919811111111", type: "audio", audio: { id: "MEDIA1", mime_type: "audio/ogg", voice: true } } }));
    expect(fact).toMatchObject({ messageKind: MESSAGE_KIND.AUDIO, attachments: [{ ref: "MEDIA1", mimeType: "audio/ogg" }] });
  });

  it("a cart keeps retailer ids and quantities and drops Meta's prices (ADR-0002)", () => {
    const [fact] = translateEvent(
      whatsapp("messages", {
        contacts,
        message: { id: "w", from: "919811111111", type: "order", order: { catalog_id: "CAT", text: "fast pls", product_items: [{ product_retailer_id: "P1", quantity: "2", item_price: 1, currency: "INR" }, { product_retailer_id: "P2", quantity: 0 }] } },
      }),
    );
    expect(fact).toEqual(expect.objectContaining({ kind: FACT_KIND.CART_ORDER, items: [{ retailerId: "P1", quantity: 2 }], note: "fast pls" }));
    expect(JSON.stringify(fact)).not.toContain("item_price");
  });

  it("a tapped reply button carries its payload", () => {
    const [fact] = translateEvent(whatsapp("messages", { contacts, message: { id: "w", from: "919811111111", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "FO_YES:c9", title: "Yes, keep me posted" } } } }));
    expect(fact).toMatchObject({ messageKind: MESSAGE_KIND.BUTTON, buttonPayload: "FO_YES:c9", text: "Yes, keep me posted" });
  });

  it("what WhatsApp cannot show is a named line, never dropped (inbox-core R8)", () => {
    const [fact] = translateEvent(whatsapp("messages", { contacts, message: { id: "w", from: "919811111111", type: "unsupported" } }));
    expect(fact).toMatchObject({ messageKind: MESSAGE_KIND.UNSUPPORTED, unsupportedLabel: expect.any(String) });
  });

  it("a status carries our callback reference and Meta's billing category", () => {
    const [fact] = translateEvent(
      whatsapp("messages.status", {
        status: {
          id: "wamid.OUT",
          status: "delivered",
          recipient_id: "919811111111",
          biz_opaque_callback_data: "send-row-1",
          pricing: { category: "marketing_lite", billable: true },
          conversation: { id: "conv1", expiration_timestamp: "1764086400" },
        },
      }),
    );
    expect(fact).toMatchObject({
      kind: FACT_KIND.MESSAGE_STATUS,
      status: "delivered",
      recipientKey: "919811111111",
      callbackRef: "send-row-1",
      pricingCategory: "marketing",
      billable: true,
      windowClosesAt: new Date(1764086400 * 1000),
    });
  });

  it("one sync with three contacts is three facts, each with its own key", () => {
    const facts = translateEvent(
      whatsapp("smb_app_state_sync", {
        state_sync: [
          { type: "contact", action: "add", contact: { full_name: "A", phone_number: "919800000001" } },
          { type: "contact", action: "remove", contact: { phone_number: "+919800000002" } },
          { type: "contact", action: "add", contact: { full_name: "C", phone_number: "919800000003" } },
        ],
      }),
    );
    expect(facts.map((f) => f.key)).toEqual(["k1", "k1#1", "k1#2"]);
    expect(facts[1]).toMatchObject({ kind: FACT_KIND.CONTACT_CHANGE, action: "remove", phone: "+919800000002" });
  });

  it("a template verdict and an account change", () => {
    expect(translateEvent(whatsapp("message_template_status_update", { event: "REJECTED", message_template_id: 77, message_template_name: "offer", reason: "PROMOTIONAL" }))[0]).toMatchObject({
      kind: FACT_KIND.TEMPLATE_STATUS,
      templateId: "77",
      status: "rejected",
    });
    expect(translateEvent(whatsapp("message_template_status_update", { event: "PENDING", message_template_id: 78 }))[0]).toMatchObject({ status: "in-review" });
    expect(translateEvent(whatsapp("account_update", { event: "ACCOUNT_OFFBOARDED" }))[0]).toMatchObject({ kind: FACT_KIND.ACCOUNT_UPDATE, event: "offboarded" });
    expect(translateEvent(whatsapp("account_update", { event: "PARTNER_REMOVED" }))[0]).toMatchObject({ event: "removed" });
    expect(translateEvent(whatsapp("phone_number_quality_update", { event: "FLAGGED", current_limit: "TIER_1K" }))[0]).toMatchObject({ event: "quality-changed", detail: "TIER_1K" });
  });

  it("an echo from the shop's own app is outbound, to the person", () => {
    const [fact] = translateEvent(whatsapp("smb_message_echoes", { message_echoes: [{ id: "e1", from: "919800000000", to: "919811111111", type: "text", text: { body: "Sure" } }] }));
    expect(fact).toMatchObject({ kind: FACT_KIND.OUTBOUND_ECHO, personKey: "919811111111", text: "Sure" });
  });

  it("a click-to-WhatsApp ad's referral and a form reply are kept", () => {
    const [ad] = translateEvent(whatsapp("messages", { contacts, message: { id: "w", from: "919811111111", type: "text", text: { body: "hi" }, referral: { source_id: "AD1", source_url: "https://fb.me/x" } } }));
    expect(ad).toMatchObject({ referral: "AD1" });
    const [form] = translateEvent(whatsapp("messages", { contacts, message: { id: "w2", from: "919811111111", type: "interactive", interactive: { type: "nfm_reply", nfm_reply: { body: "Sent", response_json: "{}" } } } }));
    expect(form).toMatchObject({ messageKind: MESSAGE_KIND.FORM_REPLY });
  });
});

describe("Instagram into facts", () => {
  it("a DM, a story reply and an echo", () => {
    const [dm] = translateEvent(instagram("messaging.message", { sender: { id: "P1" }, recipient: { id: "IG1" }, message: { mid: "m1", text: "price?" } }));
    expect(dm).toMatchObject({ kind: FACT_KIND.INBOUND_MESSAGE, messageKind: MESSAGE_KIND.TEXT, personKey: "P1", messageId: "m1" });
    const [story] = translateEvent(instagram("messaging.message", { sender: { id: "P1" }, recipient: { id: "IG1" }, message: { mid: "m2", text: "this?", reply_to: { story: { id: "S1", url: "https://x" } } } }));
    expect(story).toMatchObject({ messageKind: MESSAGE_KIND.STORY_REPLY, storyRef: "S1" });
    const [echo] = translateEvent(instagram("messaging.message", { sender: { id: "IG1" }, recipient: { id: "P1" }, message: { mid: "m3", text: "yes", is_echo: true } }));
    expect(echo).toMatchObject({ kind: FACT_KIND.OUTBOUND_ECHO, personKey: "P1" });
  });

  it("every attachment of a message is kept, and an unsend is its own fact", () => {
    const [many] = translateEvent(
      instagram("messaging.message", { sender: { id: "P1" }, message: { mid: "m9", attachments: [{ type: "image", payload: { url: "https://a" } }, { type: "image", payload: { url: "https://b" } }] } }),
    );
    expect(many).toMatchObject({ messageKind: MESSAGE_KIND.IMAGE, attachments: [{ ref: "https://a" }, { ref: "https://b" }] });
    const [unsent] = translateEvent(instagram("messaging.message", { sender: { id: "P1" }, message: { mid: "m9", is_deleted: true } }));
    expect(unsent).toMatchObject({ kind: FACT_KIND.MESSAGE_DELETED, messageId: "m9" });
  });

  it("an unreact clears the emoji; an edit carries the new text", () => {
    expect(translateEvent(instagram("messaging.reaction", { sender: { id: "P1" }, reaction: { mid: "m1", action: "unreact" } }))[0]).toMatchObject({ kind: FACT_KIND.REACTION, emoji: null });
    expect(translateEvent(instagram("messaging.edit", { sender: { id: "P1" }, message_edit: { mid: "m1", text: "new" } }))[0]).toMatchObject({ kind: FACT_KIND.MESSAGE_EDIT, text: "new" });
  });

  it("a comment names its post and its author's handle", () => {
    const [fact] = translateEvent(instagram("comments", { id: "C1", text: "SHOP", from: { id: "U1", username: "zara" }, media: { id: "M1" } }));
    expect(fact).toMatchObject({ kind: FACT_KIND.COMMENT, commentId: "C1", mediaId: "M1", personHandle: "zara", text: "SHOP" });
  });

  it("a postback is a tapped button", () => {
    const [fact] = translateEvent(instagram("messaging.postback", { sender: { id: "P1" }, postback: { mid: "pb1", title: "Delivery", payload: "Q_DELIVERY" } }));
    expect(fact).toMatchObject({ kind: FACT_KIND.INBOUND_MESSAGE, messageKind: MESSAGE_KIND.BUTTON, buttonPayload: "Q_DELIVERY" });
  });

  it("a read receipt yields nothing for now", () => {
    expect(translateEvent(instagram("messaging.read", { sender: { id: "P1" }, read: { mid: "m1" } }))).toEqual([]);
  });

  it("every fact from every case parses as a social fact", () => {
    const all = [
      ...translateEvent(instagram("messaging.message", { sender: { id: "P1" }, message: { mid: "m1", attachments: [{ type: "image", payload: { url: "https://x" } }] } })),
      ...translateEvent(instagram("comments", { id: "C2", text: "", from: { id: "U1" } })),
      ...translateEvent(whatsapp("messages.status", { status: { id: "x", status: "read", pricing: { category: "brand_new_category" } } })),
      ...translateEvent(whatsapp("message_template_status_update", { event: "SOMETHING_NEW", message_template_id: 1 })),
      ...translateEvent(whatsapp("smb_message_echoes", { message_echoes: [{ id: "e", to: "919800000000", type: "image", image: { id: "M" } }] })),
    ];
    for (const fact of all) expect(socialFact.safeParse(fact).success).toBe(true);
  });
});
