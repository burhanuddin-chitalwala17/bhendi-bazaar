/**
 * One parcel vocabulary, and the order's status read off it
 * ([order-fulfilment](../../docs/specs/own-store/order-fulfilment/trd.md) D1, D4).
 */
import { describe, expect, it } from "vitest";

import {
  CANCELLABLE_FROM,
  SHIPMENT_STATUS,
  canTransition,
} from "@server/shipping/domain/shipping.types";
import { summariseParcels } from "@server/checkout/parcel-summary";
import { ORDER_STATUS } from "@server/checkout/order.types";

const S = SHIPMENT_STATUS;

describe("hand booking has two waits a person can see (spec R2)", () => {
  it("walks packing → ready_for_pickup → pickup_booked → picked_up", () => {
    expect(canTransition(S.PACKING, S.READY_FOR_PICKUP)).toBe(true);
    expect(canTransition(S.READY_FOR_PICKUP, S.PICKUP_BOOKED)).toBe(true);
    expect(canTransition(S.PICKUP_BOOKED, S.PICKED_UP)).toBe(true);
  });

  it("never reaches picked_up without a booking (spec R2: no false pickup)", () => {
    expect(canTransition(S.PACKING, S.PICKED_UP)).toBe(false);
    expect(canTransition(S.READY_FOR_PICKUP, S.PICKED_UP)).toBe(false);
  });

  it("cancels from the three pre-pickup states and nowhere after (spec R1)", () => {
    for (const s of [S.PACKING, S.READY_FOR_PICKUP, S.PICKUP_BOOKED]) {
      expect(canTransition(s, S.CANCELLED), s).toBe(true);
    }
    expect(canTransition(S.PICKED_UP, S.CANCELLED)).toBe(false);
  });

  it("lets buyer and shop cancel only while packing, the admin until booked (Q9)", () => {
    expect(CANCELLABLE_FROM.buyer).toEqual([S.PACKING]);
    expect(CANCELLABLE_FROM.shop).toEqual([S.PACKING]);
    expect([...CANCELLABLE_FROM.admin].sort()).toEqual(
      [S.PACKING, S.READY_FOR_PICKUP, S.PICKUP_BOOKED].sort(),
    );
    // Every actor's list is a subset of what the table allows.
    for (const from of Object.values(CANCELLABLE_FROM).flat()) {
      expect(canTransition(from, S.CANCELLED), from).toBe(true);
    }
  });
});

describe("summariseParcels — the order's status is derived (spec R1, Q5)", () => {
  it("is confirmed while every parcel is still with the shop", () => {
    expect(summariseParcels([S.PACKING, S.READY_FOR_PICKUP, S.PICKUP_BOOKED])).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("is shipped once any parcel has left the shop", () => {
    expect(summariseParcels([S.PACKING, S.PICKED_UP])).toBe(ORDER_STATUS.SHIPPED);
    expect(summariseParcels([S.DELIVERED, S.IN_TRANSIT])).toBe(ORDER_STATUS.SHIPPED);
  });

  it("is delivered only when every live parcel is delivered", () => {
    expect(summariseParcels([S.DELIVERED, S.DELIVERED])).toBe(ORDER_STATUS.DELIVERED);
    // A cancelled parcel is not waiting for anything.
    expect(summariseParcels([S.DELIVERED, S.CANCELLED])).toBe(ORDER_STATUS.DELIVERED);
  });

  it("is cancelled only when every parcel is", () => {
    expect(summariseParcels([S.CANCELLED, S.CANCELLED])).toBe(ORDER_STATUS.CANCELLED);
    expect(summariseParcels([S.CANCELLED, S.PACKING])).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("says nothing about an order with no parcels", () => {
    expect(summariseParcels([])).toBeNull();
  });
});
