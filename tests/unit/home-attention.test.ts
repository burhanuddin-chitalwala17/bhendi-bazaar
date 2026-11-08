// Home's "Needs you now" (seller-onboarding R2, D7; Q22, Q25; design-system Q31): a zero hides its
// line, a failed read keeps it with a retry rather than pretending nothing needs the shop, buyers and
// money come first, five at most; and the toast after a task says the step and the new count (R7).
import { describe, expect, it } from "vitest";
import { CARD_STATE } from "@server/channels/channel-connection.types";
import { STOCK_ATTENTION } from "@server/channels/channel-stock.types";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";
import { attentionLines } from "@/components/org/home/attention-lines";
import { doneToast } from "@/components/org/home/home-copy";

const now = new Date("2026-11-01T10:00:00Z");
const HOUR = 3_600_000;
const quiet = (): HomeAttentionDto => ({
  toPack: { ok: true, value: { count: 0, oldestPaidAt: null } },
  lowStock: { ok: true, value: { count: 0, soldOut: 0, soonestDays: null } },
  channel: { ok: true, value: null },
  stock: { ok: true, value: null },
  listingProblems: { ok: true, value: null },
  channelAsks: { ok: true, value: null },
  channelNeeds: { ok: true, value: [] },
  photos: { ok: true, value: 0 },
  teamEdits: { ok: true, value: { count: 0, productId: null } },
});

describe("needs you now", () => {
  it("is empty when nothing needs the shop, so the page shows its all-clear", () => {
    expect(attentionLines("o1", quiet(), now)).toEqual([]);
  });

  it("keeps a failed read as its own retry line, never as nothing to do", () => {
    const lines = attentionLines("o1", { ...quiet(), toPack: { ok: false }, photos: { ok: false } }, now);
    expect(lines.map((line) => [line.key, line.ok])).toEqual([["toPack", false], ["photos", false]]);
    expect(lines[0].text).toBe("Couldn't load orders.");
  });

  it("says how long the longest-waiting buyer has waited (Q31)", () => {
    const paid = (ms: number) => ({ ok: true as const, value: { count: 3, oldestPaidAt: new Date(now.getTime() - ms).toISOString() } });
    expect(attentionLines("o1", { ...quiet(), toPack: paid(5 * HOUR) }, now)[0]).toMatchObject({ text: "3 orders to pack · oldest waiting 5 h", href: "/org/o1/orders" });
    expect(attentionLines("o1", { ...quiet(), toPack: paid(50 * HOUR) }, now)[0]).toMatchObject({ text: "3 orders to pack · oldest waiting 2 days" });
    expect(attentionLines("o1", { ...quiet(), toPack: paid(60_000) }, now)[0]).toMatchObject({ text: "3 orders to pack · oldest waiting 1 h" });
  });

  it("words selling low stock by what is sold out, else by when the first runs out, and opens the low-stock filter", () => {
    const low = (soldOut: number, soonestDays: number | null) => attentionLines("o1", { ...quiet(), lowStock: { ok: true, value: { count: 2, soldOut, soonestDays } } }, now)[0];
    expect(low(1, 4)).toMatchObject({ text: "2 selling products low on stock · 1 sold out", href: "/org/o1/products?lowStock=true" });
    expect(low(0, 4)).toMatchObject({ text: "2 selling products low on stock · runs out in about 4 days" });
    expect(low(0, 1)).toMatchObject({ text: "2 selling products low on stock · runs out in about 1 day" });
    expect(low(0, 0)).toMatchObject({ text: "2 selling products low on stock · runs out today" });
  });

  it("asks for the location match that stock sync waits on, on that marketplace's Listings (inventory-sync Q28)", () => {
    const lines = attentionLines("o1", { ...quiet(), stock: { ok: true, value: { channel: "amazon", label: "Amazon", kind: STOCK_ATTENTION.MATCH, count: 0 } } }, now);
    expect(lines[0]).toMatchObject({ text: "Match your Amazon locations so stock can be sent", href: "/org/o1/channels/amazon/listings" });
  });

  it("names listings a marketplace stopped, and opens the ones needing a fix (marketplace-publish Q23)", () => {
    const lines = attentionLines("o1", { ...quiet(), listingProblems: { ok: true, value: { channel: "amazon", label: "Amazon", problems: 3, suppressed: 2 } } }, now);
    expect(lines[0]).toMatchObject({ text: "3 Amazon listings need a fix: 2 hidden from shoppers", href: "/org/o1/channels/amazon/listings?fix=1" });
  });

  it("says a channel now asks more of a type the shop sells, and opens that channel's products (listing-model Q22)", () => {
    const lines = attentionLines("o1", { ...quiet(), channelAsks: { ok: true, value: { channel: "amazon", label: "Amazon", typeLabel: "Tote bag", added: 2 } } }, now);
    expect(lines[0]).toMatchObject({ text: "Amazon now asks 2 more details for Tote bag", href: "/org/o1/products?channel=amazon" });
  });

  it("puts buyers and money first and shows at most five (Q31)", () => {
    const lines = attentionLines(
      "o1",
      {
        toPack: { ok: true, value: { count: 1, oldestPaidAt: new Date(now.getTime() - 2 * HOUR).toISOString() } },
        lowStock: { ok: true, value: { count: 2, soldOut: 0, soonestDays: 3 } },
        channel: { ok: true, value: { channel: "amazon" as never, label: "Amazon", state: CARD_STATE.NEEDS_RECONNECT, reapproveBy: null } },
        stock: { ok: true, value: { channel: "amazon", label: "Amazon", kind: STOCK_ATTENTION.OUT_OF_STOCK, count: 2 } },
        listingProblems: { ok: true, value: null },
        channelAsks: { ok: true, value: null },
        channelNeeds: { ok: true, value: [] },
        photos: { ok: true, value: 3 },
        teamEdits: { ok: true, value: { count: 1, productId: null } },
      },
      now,
    );
    expect(lines.map((line) => line.text)).toEqual([
      "1 order to pack · oldest waiting 2 h",
      "Amazon needs you to reconnect",
      "2 listings now out of stock on Amazon: we have 0",
      "2 selling products low on stock · runs out in about 3 days",
      "3 photos can be improved",
    ]);
  });
});

describe("the toast after a task (R7)", () => {
  it("names the step and the new count", () => {
    expect(doneToast(ONBOARDING_STEP.PRODUCT, 2)).toBe("Product added · 2 of 5 done");
    expect(doneToast(ONBOARDING_STEP.ADDRESS, 3)).toBe("Pickup address added · 3 of 5 done");
    expect(doneToast(ONBOARDING_STEP.SHARE, 5)).toBe("Shared · 5 of 5 done");
  });

  it("says per channel how many products still need details, from stored completeness (dynamic-form R5)", () => {
    const needs = attentionLines("o1", { ...quiet(), channelNeeds: { ok: true, value: [{ channel: "flipkart", products: 38, details: 4 }] } }, new Date("2026-11-08T00:00:00Z"));
    expect(needs.find((l) => l.key === "channelNeeds:flipkart")).toMatchObject({ text: "38 products need up to 4 details for Flipkart", href: "/org/o1/products?channel=flipkart" });
  });
});
