/**
 * The hub's pure rules (notification-hub/notifications-core D1, D2): an event's facts are ids, never a
 * message body (Q7), and policy alone picks each kind's channels and timing (R1, R5).
 */
import { describe, expect, it } from "vitest";
import { emitInput, NOTIFICATION_AUDIENCE, NOTIFICATION_KIND } from "@server/notifications/notification.types";
import { DELIVERY_POLICY } from "@server/notifications/policy";

const base = { kind: NOTIFICATION_KIND.POST_FAILED, orgId: "org1", audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, eventKey: "post-failed:p1" };

describe("an event's facts (D1, Q7)", () => {
  it("accepts ids", () => {
    expect(emitInput.safeParse({ ...base, facts: { postId: "cm1abc", channel: "instagram" } }).success).toBe(true);
  });

  it("refuses a message body, so none is ever stored", () => {
    expect(emitInput.safeParse({ ...base, facts: { text: "Hello, is this kurta still available?" } }).success).toBe(false);
    expect(emitInput.safeParse({ ...base, facts: { postId: "x".repeat(65) } }).success).toBe(false);
  });

  it("a shop event names no recipient, a buyer event must", () => {
    expect(emitInput.safeParse({ ...base, recipientRef: "u1", facts: {} }).success).toBe(false);
    expect(emitInput.safeParse({ ...base, audience: NOTIFICATION_AUDIENCE.BUYER, facts: {} }).success).toBe(false);
    expect(emitInput.safeParse({ ...base, audience: NOTIFICATION_AUDIENCE.BUYER, recipientRef: "u1", facts: {} }).success).toBe(true);
  });

  it("refuses a kind outside the closed set", () => {
    expect(emitInput.safeParse({ ...base, kind: "something-else", facts: {} }).success).toBe(false);
  });
});

describe("policy picks the channel, never the module (D2, R1)", () => {
  it("A4: a Status due is a badge and an email at once", () => {
    expect(DELIVERY_POLICY[NOTIFICATION_KIND.POST_DUE]).toEqual([
      { channel: "badge", timing: "BADGE" },
      { channel: "email", timing: "AT_ONCE" },
    ]);
  });

  it("A1, A2: everything else is a badge now and the morning email", () => {
    for (const kind of [NOTIFICATION_KIND.CONVERSATION_WAITING, NOTIFICATION_KIND.POST_FAILED, NOTIFICATION_KIND.CONNECTION_NEEDS_YOU, NOTIFICATION_KIND.POST_HELD]) {
      expect(DELIVERY_POLICY[kind]).toEqual([
        { channel: "badge", timing: "BADGE" },
        { channel: "email", timing: "DIGEST" },
      ]);
    }
  });
});
