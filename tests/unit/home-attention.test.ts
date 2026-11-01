// Home's "Needs you now" (seller-onboarding R2, D7; Q13, Q22, Q25): a zero hides its line, a failed
// read keeps it with a retry rather than pretending nothing needs the shop, and the toast after a
// task says the step and the new count (R7).
import { describe, expect, it } from "vitest";
import { CARD_STATE } from "@server/channels/channel-connection.types";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";
import { attentionLines } from "@/components/org/home/attention-lines";
import { doneToast } from "@/components/org/home/home-copy";

const now = new Date("2026-11-01T10:00:00Z");
const quiet = (): HomeAttentionDto => ({
  parcels: { ok: true, value: 0 },
  reviews: { ok: true, value: { count: 0, productId: null } },
  channel: { ok: true, value: null },
  photos: { ok: true, value: 0 },
  auction: { ok: true, value: null },
});

describe("needs you now", () => {
  it("is empty when nothing needs the shop", () => {
    expect(attentionLines("o1", quiet(), now)).toEqual([]);
  });

  it("keeps a failed read as its own retry line, never as nothing to do", () => {
    const lines = attentionLines("o1", { ...quiet(), parcels: { ok: false }, photos: { ok: false } }, now);
    expect(lines.map((line) => [line.key, line.ok])).toEqual([["parcels", false], ["photos", false]]);
    expect(lines[0].text).toBe("Couldn't load orders.");
  });

  it("opens the product when every new review is on one, else the Reviews page (Q13)", () => {
    const one = attentionLines("o1", { ...quiet(), reviews: { ok: true, value: { count: 2, productId: "p1" } } }, now);
    expect(one[0]).toMatchObject({ text: "2 new reviews", href: "/org/o1/products/p1#reviews" });
    const many = attentionLines("o1", { ...quiet(), reviews: { ok: true, value: { count: 2, productId: null } } }, now);
    expect(many[0]).toMatchObject({ href: "/org/o1/reviews" });
  });

  it("says what each area needs, in order (Q22)", () => {
    const lines = attentionLines(
      "o1",
      {
        parcels: { ok: true, value: 1 },
        reviews: { ok: true, value: { count: 0, productId: null } },
        channel: { ok: true, value: { channel: "amazon" as never, label: "Amazon", state: CARD_STATE.NEEDS_RECONNECT, reapproveBy: null } },
        photos: { ok: true, value: 3 },
        auction: { ok: true, value: { productName: "Shawl", endsAt: new Date(now.getTime() + 2 * 3_600_000).toISOString() } },
      },
      now,
    );
    expect(lines.map((line) => line.text)).toEqual([
      "1 order to pack",
      "Amazon needs you to reconnect",
      "3 photos can be improved",
      "Auction ends in 2 h",
    ]);
  });
});

describe("the toast after a task (R7)", () => {
  it("names the step and the new count", () => {
    expect(doneToast(ONBOARDING_STEP.PRODUCT, 2)).toBe("Product added · 2 of 5 done");
    expect(doneToast(ONBOARDING_STEP.ADDRESS, 3)).toBe("Pickup address added · 3 of 5 done");
    expect(doneToast(ONBOARDING_STEP.SHARE, 5)).toBe("Shared · 5 of 5 done");
  });
});
