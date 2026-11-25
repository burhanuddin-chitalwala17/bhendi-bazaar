import { describe, expect, it } from "vitest";
import { translateEvent, type StoredEvent } from "@server/channels/providers/meta/translate";
import { FACT_KIND, MESSAGE_KIND, socialFact } from "@server/shared/social-events/facts";
import { messageRows } from "@server/inbox/message-rows";

/** social-selling/inbox-whatsapp unit 1: WhatsApp's recorded payloads into facts and thread rows (D1, R1, R2, R6). */

const AT = new Date("2026-11-25T10:00:00Z");
const whatsapp = (field: string, payload: unknown): StoredEvent => ({ key: "k1", connectionId: "c1", product: "whatsapp", field, occurredAt: AT, payload });
const contacts = [{ profile: { name: "Ayesha" }, wa_id: "919811111111" }];
const msg = (message: Record<string, unknown>) => whatsapp("messages", { contacts, message: { id: "wamid.X", from: "919811111111", timestamp: "1764064800", ...message } });

describe("WhatsApp inbound types (spec A1)", () => {
  const recorded: Array<[string, Record<string, unknown>, string]> = [
    ["text", { type: "text", text: { body: "hi" } }, MESSAGE_KIND.TEXT],
    ["image", { type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: "this one" } }, MESSAGE_KIND.IMAGE],
    ["video", { type: "video", video: { id: "M2", mime_type: "video/mp4" } }, MESSAGE_KIND.VIDEO],
    ["voice note", { type: "audio", audio: { id: "M3", mime_type: "audio/ogg; codecs=opus", voice: true } }, MESSAGE_KIND.AUDIO],
    ["document", { type: "document", document: { id: "M4", mime_type: "application/pdf", filename: "size-chart.pdf" } }, MESSAGE_KIND.DOCUMENT],
    ["sticker", { type: "sticker", sticker: { id: "M5", mime_type: "image/webp", animated: false } }, MESSAGE_KIND.STICKER],
    ["location", { type: "location", location: { latitude: 18.9548, longitude: 72.8311, name: "Bhendi Bazaar", address: "Mumbai" } }, MESSAGE_KIND.LOCATION],
    ["contacts", { type: "contacts", contacts: [{ name: { formatted_name: "Zain" } }] }, MESSAGE_KIND.CONTACTS],
    ["button", { type: "button", button: { text: "Stop offers", payload: "STOP" } }, MESSAGE_KIND.BUTTON],
    ["list reply", { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "L1", title: "Size M" } } }, MESSAGE_KIND.BUTTON],
    ["unsupported", { type: "unsupported", errors: [{ code: 131051 }] }, MESSAGE_KIND.UNSUPPORTED],
  ];

  it.each(recorded)("a %s message is a fact every tool can read (spec A1)", (_name, message, kind) => {
    const [fact] = translateEvent(msg(message));
    expect(fact).toMatchObject({ kind: FACT_KIND.INBOUND_MESSAGE, messageKind: kind, personName: "Ayesha" });
    expect(socialFact.safeParse(fact).success).toBe(true);
  });

  it("the person is keyed by the scoped id where Meta gives one, else the number in E.164 (D1)", () => {
    expect(translateEvent(msg({ type: "text", text: { body: "x" } }))[0]).toMatchObject({ personKey: "+919811111111", personPhone: "+919811111111" });
    const [scoped] = translateEvent(
      whatsapp("messages", { contacts: [{ profile: { name: "A", username: "@ayesha" }, user_id: "IN.111" }], message: { id: "w", from_user_id: "IN.111", type: "text", text: { body: "x" } } }),
    );
    expect(scoped).toMatchObject({ personKey: "IN.111", personPhone: null, personHandle: "@ayesha" });
  });

  it("a location keeps where it points, so the thread can open it in Maps (R6)", () => {
    const [fact] = translateEvent(msg({ type: "location", location: { latitude: 18.9548, longitude: 72.8311, name: "Bhendi Bazaar", address: "Mumbai" } }));
    expect(fact).toMatchObject({ text: "Bhendi Bazaar, Mumbai", coordinates: { latitude: 18.9548, longitude: 72.8311 } });
    if (fact.kind !== FACT_KIND.INBOUND_MESSAGE) throw new Error("expected a message");
    expect(JSON.parse(messageRows(fact)[0].text ?? "")).toEqual({ place: "Bhendi Bazaar, Mumbai", latitude: 18.9548, longitude: 72.8311 });
  });

  it("an echo from the Business app is outbound, to the person by the same key as their messages (R2)", () => {
    const [echo] = translateEvent(whatsapp("smb_message_echoes", { message_echoes: [{ id: "e1", from: "919800000000", to: "919811111111", type: "text", text: { body: "Yes, in M" } }] }));
    const [inbound] = translateEvent(msg({ type: "text", text: { body: "M?" } }));
    expect(echo).toMatchObject({ kind: FACT_KIND.OUTBOUND_ECHO, text: "Yes, in M" });
    expect(echo.kind === FACT_KIND.OUTBOUND_ECHO && echo.personKey).toBe(inbound.kind === FACT_KIND.INBOUND_MESSAGE && inbound.personKey);
  });
});

it("an echo sorts by its own time, not the delivery's (spec hazard: crossing replies)", () => {
  const [echo] = translateEvent(whatsapp("smb_message_echoes", { message_echoes: [{ id: "e2", to: "919811111111", timestamp: "1764064860", type: "text", text: { body: "ok" } }] }));
  expect(echo.occurredAt).toEqual(new Date(1764064860 * 1000));
});

describe("a new business-scoped id (D1)", () => {
  const changed = (system: Record<string, unknown>) =>
    translateEvent(whatsapp("messages", { contacts: [], message: { id: "sys1", from_user_id: "IN.OLD", type: "system", system } }));

  it("user_changed_user_id re-keys the person from the old id to the new", () => {
    const [fact] = changed({ type: "user_changed_user_id", body: "User changed", user_id: "IN.NEW" });
    expect(fact).toMatchObject({ kind: FACT_KIND.PERSON_REKEYED, previousKey: "IN.OLD", personKey: "IN.NEW" });
    expect(socialFact.safeParse(fact).success).toBe(true);
  });

  it("any other system notice, or one naming no new id, yields nothing", () => {
    expect(changed({ type: "customer_identity_changed", wa_id: "919822222222", user_id: "IN.OTHER" })).toEqual([]);
    expect(changed({ type: "user_changed_user_id" })).toEqual([]);
    expect(changed({ type: "user_changed_user_id", user_id: "IN.OLD" })).toEqual([]);
  });
});
