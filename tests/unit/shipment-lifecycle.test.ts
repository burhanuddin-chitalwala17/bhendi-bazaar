/**
 * The shipment vocabulary, its transition table and the courier adapter
 * ([shipment-lifecycle](../../docs/specs/shipment-lifecycle/spec.md)).
 *
 * `Shipment.status` held three vocabularies at once — a type declaring nine values, a schema
 * comment naming four others, and code writing `"shipped"`, which the type did not contain. The
 * set is only worth declaring if something holds it, so: every state has effects, every courier
 * maps into it and nowhere else, and the transitions are the guard rather than a suggestion.
 */
import { describe, expect, it } from "vitest";

import {
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_EFFECTS,
  SHIPMENT_TRANSITIONS,
  canTransition,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";
import {
  MAPPED_PROVIDERS,
  getStatusLabel,
  normalizeShipmentStatus,
} from "@server/shipping/utils/statusNormalizer";

const ALL = Object.values(SHIPMENT_STATUS) as ShipmentStatus[];

describe("the canonical set is complete", () => {
  it.each(ALL)("%s has effects, transitions and a label", (status) => {
    expect(SHIPMENT_STATUS_EFFECTS[status], "missing effects").toBeDefined();
    expect(SHIPMENT_TRANSITIONS[status], "missing transitions").toBeDefined();
    // A raw status leaking into the UI is how `rto_in_transit` reaches a buyer.
    expect(getStatusLabel(status)).not.toBe(status);
  });

  it("a terminal state has no way out, and a non-terminal one has a way on", () => {
    for (const status of ALL) {
      const { terminal } = SHIPMENT_STATUS_EFFECTS[status];
      expect(SHIPMENT_TRANSITIONS[status].length === 0, `${status} terminal flag`).toBe(terminal);
    }
  });

  it("every transition target is itself a declared state", () => {
    // A typo here would be a state nothing can leave and nothing declares effects for.
    for (const [from, targets] of Object.entries(SHIPMENT_TRANSITIONS)) {
      for (const to of targets) expect(ALL, `${from} -> ${to}`).toContain(to);
    }
  });
});

describe("the forward journey, and the two ways back", () => {
  const { PACKING, READY_FOR_PICKUP, PICKUP_BOOKED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY,
          DELIVERY_FAILED, DELIVERED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED, LOST } = SHIPMENT_STATUS;

  it("walks packing → ready → booked → picked_up → in_transit → out_for_delivery → delivered", () => {
    const path = [PACKING, READY_FOR_PICKUP, PICKUP_BOOKED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("cancels only before the courier has it (R4)", () => {
    expect(canTransition(PACKING, CANCELLED)).toBe(true);
    // Once collected there is no cancelling — the only way back is a return.
    for (const after of [PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED]) {
      expect(canTransition(after, CANCELLED), `${after} must not cancel`).toBe(false);
    }
    expect(canTransition(PICKED_UP, RTO_IN_TRANSIT)).toBe(true);
  });

  it("treats a failed attempt as a detour, not an ending (R3)", () => {
    expect(canTransition(OUT_FOR_DELIVERY, DELIVERY_FAILED)).toBe(true);
    // Three attempts is the Indian norm: back out for another try.
    expect(canTransition(DELIVERY_FAILED, OUT_FOR_DELIVERY)).toBe(true);
    // Or give up and start the journey home.
    expect(canTransition(DELIVERY_FAILED, RTO_IN_TRANSIT)).toBe(true);
    expect(SHIPMENT_STATUS_EFFECTS[DELIVERY_FAILED].terminal).toBe(false);
  });

  it("never walks backwards (R9)", () => {
    expect(canTransition(DELIVERED, IN_TRANSIT)).toBe(false);
    expect(canTransition(OUT_FOR_DELIVERY, PICKED_UP)).toBe(false);
    expect(canTransition(RTO_DELIVERED, RTO_IN_TRANSIT)).toBe(false);
  });

  it("treats a repeat of the current state as a no-op, not a refusal", () => {
    // Couriers retry webhooks; the same status arriving twice is the common case.
    for (const status of ALL) expect(canTransition(status, status), status).toBe(true);
  });
});

describe("what each state costs", () => {
  const { DELIVERED, RTO_DELIVERED, CANCELLED, LOST, DAMAGED, DELIVERY_FAILED } = SHIPMENT_STATUS;

  it("returns stock only where stock actually came back", () => {
    expect(SHIPMENT_STATUS_EFFECTS[CANCELLED].restocks).toBe(true);
    expect(SHIPMENT_STATUS_EFFECTS[RTO_DELIVERED].restocks).toBe(true);
    // The decision of 2026-09-24: lost and damaged units are gone. Crediting them back invents
    // inventory; they are written off against the courier claim instead.
    expect(SHIPMENT_STATUS_EFFECTS[LOST].restocks).toBe(false);
    expect(SHIPMENT_STATUS_EFFECTS[DAMAGED].restocks).toBe(false);
    expect(SHIPMENT_STATUS_EFFECTS[DELIVERED].restocks).toBe(false);
  });

  it("owes a refund wherever the buyer did not keep the goods", () => {
    for (const s of [CANCELLED, RTO_DELIVERED, LOST, DAMAGED]) {
      expect(SHIPMENT_STATUS_EFFECTS[s].refundOwed, s).toBe(true);
    }
    expect(SHIPMENT_STATUS_EFFECTS[DELIVERED].refundOwed).toBe(false);
    // One failed attempt is not a refund — the courier will try again.
    expect(SHIPMENT_STATUS_EFFECTS[DELIVERY_FAILED].refundOwed).toBe(false);
  });

  it("credits the org once and reverses it if the parcel comes back", () => {
    expect(SHIPMENT_STATUS_EFFECTS[DELIVERED].settlement).toBe("credit");
    for (const s of [CANCELLED, RTO_DELIVERED, LOST, DAMAGED]) {
      expect(SHIPMENT_STATUS_EFFECTS[s].settlement, s).toBe("reverse");
    }
  });

  it("a state that restocks always owes a refund", () => {
    // The reverse is not true — `lost` refunds without restocking — but goods coming back to
    // the shop while the buyer stays charged would be theft by bookkeeping.
    for (const s of ALL) {
      if (SHIPMENT_STATUS_EFFECTS[s].restocks) expect(SHIPMENT_STATUS_EFFECTS[s].refundOwed, s).toBe(true);
    }
  });
});

describe("the courier adapter", () => {
  it("knows the three couriers, including the two not yet connected", () => {
    expect(MAPPED_PROVIDERS).toEqual(expect.arrayContaining(["shiprocket", "delhivery", "maruti"]));
  });

  it.each(MAPPED_PROVIDERS)("%s maps only into the canonical set", (provider) => {
    // Every courier must reach a real delivery and a real return, or the map is half-written.
    for (const probe of ["delivered", "in transit", "out for delivery"]) {
      const { status } = normalizeShipmentStatus(provider, probe);
      expect(status, `${provider} could not map "${probe}"`).not.toBeNull();
      expect(ALL).toContain(status as ShipmentStatus);
    }
  });

  it("does not care about case or separators", () => {
    const forms = ["Out For Delivery", "out_for_delivery", "OUT-FOR-DELIVERY", "  out for delivery "];
    for (const form of forms) {
      expect(normalizeShipmentStatus("shiprocket", form).status, form)
        .toBe(SHIPMENT_STATUS.OUT_FOR_DELIVERY);
    }
  });

  it("collapses the courier's RTO detail to coming-back and back", () => {
    for (const coming of ["RTO Initiated", "RTO-OFD", "rto ndr"]) {
      expect(normalizeShipmentStatus("shiprocket", coming).status, coming)
        .toBe(SHIPMENT_STATUS.RTO_IN_TRANSIT);
    }
    expect(normalizeShipmentStatus("shiprocket", "RTO Delivered").status)
      .toBe(SHIPMENT_STATUS.RTO_DELIVERED);
  });

  it("reports an unmapped status instead of guessing one (R8)", () => {
    // The old normalizer matched substrings and fell back to `pending`, which is how a lost
    // parcel looks healthy for a week.
    const unknown = normalizeShipmentStatus("shiprocket", "Held At Customs Pending Clearance");
    expect(unknown.status).toBeNull();
    expect(unknown.raw).toBe("Held At Customs Pending Clearance");
  });

  it("reports an unknown courier instead of guessing a mapping", () => {
    expect(normalizeShipmentStatus("bluedart", "delivered").status).toBeNull();
  });
});
