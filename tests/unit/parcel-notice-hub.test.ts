/**
 * Parcel notices on the hub, without a database (notification-hub/notifications-core D6, Q15): a parcel kind
 * names its one address and carries its snapshot, a shop alert still carries ids only, and each parcel kind is
 * one email at once with no badge.
 */
import { describe, expect, it } from "vitest";
import { emitInput, NOTIFICATION_AUDIENCE, NOTIFICATION_KIND } from "@server/notifications/notification.types";
import { NOTICE_KIND } from "@server/notifications/notice.types";
import { policyFor } from "@server/notifications/policy";

const snapshot = {
  orderId: "o1", orderCode: "BB-4821", parcelCode: "BB-4821-SH1", orgId: "org_1",
  shopName: "Noor Attar", city: "New Delhi", since: "2026-11-01T10:30:00.000Z", refundPaise: 129900,
};
const parcel = { kind: NOTICE_KIND.CANCELLED_SHOP, orgId: "org_1", audience: NOTIFICATION_AUDIENCE.SHOP_INBOX, eventKey: "notice:s1:cancelled_shop:shop:" };

describe("a parcel notice on the hub (D6, Q15)", () => {
  it("A5: carries its snapshot to the one address it was written to", () => {
    expect(emitInput.safeParse({ ...parcel, recipientRef: "shop@example.test", facts: snapshot }).success).toBe(true);
  });

  it("names its address: only a shop's members are left for the hub to find", () => {
    expect(emitInput.safeParse({ ...parcel, facts: snapshot }).success).toBe(false);
    expect(emitInput.safeParse({ ...parcel, audience: NOTIFICATION_AUDIENCE.STAFF_INBOX, facts: snapshot }).success).toBe(false);
  });

  it("keeps each kind to the audiences that fit it: an address is never mistaken for a user, or a user for an address", () => {
    expect(emitInput.safeParse({ ...parcel, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: snapshot }).success).toBe(false);
    const alert = { kind: NOTIFICATION_KIND.POST_FAILED, orgId: "org_1", eventKey: "post-failed:p2", facts: { postId: "p2" } };
    expect(emitInput.safeParse({ ...alert, audience: NOTIFICATION_AUDIENCE.SHOP_INBOX, recipientRef: "shop@example.test" }).success).toBe(false);
    expect(emitInput.safeParse({ ...alert, audience: NOTIFICATION_AUDIENCE.BUYER, recipientRef: "u1" }).success).toBe(true);
  });

  it("refuses a snapshot missing what its email prints", () => {
    const missing = { ...snapshot, orderCode: undefined };
    expect(emitInput.safeParse({ ...parcel, recipientRef: "shop@example.test", facts: missing }).success).toBe(false);
  });

  it("a shop alert still carries ids only: the parcel snapshot is not a way round Q7", () => {
    const alert = { kind: NOTIFICATION_KIND.POST_FAILED, orgId: "org_1", audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, eventKey: "post-failed:p1" };
    expect(emitInput.safeParse({ ...alert, facts: snapshot }).success).toBe(false);
  });

  it("every parcel kind is one email at once and no badge, as before the hub", () => {
    for (const kind of Object.values(NOTICE_KIND)) expect(policyFor(kind)).toEqual([{ channel: "email", timing: "AT_ONCE" }]);
    expect(policyFor(NOTIFICATION_KIND.POST_DUE)).toHaveLength(2);
  });
});
