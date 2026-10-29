// What each marketplace's stock and order calls become (inventory-sync D1, D3–D5). Shapes follow the
// calls checked on production 2026-10-29 and each marketplace's documents; never a live call.
import { afterEach, describe, expect, it, vi } from "vitest";

import { amazonReadOrders, stockFromItem } from "@server/channels/providers/amazon/amazon.stock";
import { linesFrom, locationsFrom, stockFromDetails } from "@server/channels/providers/flipkart/flipkart.stock";

describe("Amazon stock (Q5, Q12)", () => {
  it("reads the count the shop ships itself, and knows a listing Amazon stocks itself", () => {
    expect(stockFromItem({ fulfillmentAvailability: [{ fulfillmentChannelCode: "DEFAULT", quantity: 7 }] })).toEqual({
      counts: [{ externalId: "DEFAULT", quantity: 7 }],
      heldByMarketplace: false,
    });
    expect(stockFromItem({ fulfillmentAvailability: [{ fulfillmentChannelCode: "AMAZON_IN" }] })).toEqual({ counts: [], heldByMarketplace: true });
    expect(stockFromItem({})).toEqual({ counts: [], heldByMarketplace: false });
  });
});

describe("Amazon orders (Q21, Q24)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never asks for orders updated within two minutes of now, as a cursor set at turn-on would", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({ payload: { Orders: [] } }), { status: 200 });
    });
    const before = Date.now();
    const page = await amazonReadOrders(async () => "token", "SELLER", new Date().toISOString());
    const after = new Date(new URL(asked[0]).searchParams.get("LastUpdatedAfter")!).getTime();
    expect(after).toBeLessThanOrEqual(before - 2 * 60_000 + 1_000);
    expect(new Date(page.cursor).getTime()).toBeLessThanOrEqual(Date.now() - 2 * 60_000 + 1_000);
  });
});

describe("Flipkart locations, stock and orders (Q12, Q18)", () => {
  it("reads locations whatever its documents call the fields", () => {
    expect(locationsFrom({ locations: [{ locationId: "LOC1", locationName: "Bhiwandi WH", address: { pincode: "421302" } }, { id: "LOC2", name: "Pune" }, { name: "no id" }] })).toEqual([
      { externalId: "LOC1", name: "Bhiwandi WH", pincode: "421302" },
      { externalId: "LOC2", name: "Pune", pincode: null },
    ]);
  });

  it("reads a listing's count per location", () => {
    expect(stockFromDetails({ available: { "HJB-1": { locations: [{ id: "LOC1", inventory: 4 }, { id: "LOC2", inventory: "2" }] } } }, "HJB-1")).toEqual({
      counts: [{ externalId: "LOC1", quantity: 4 }, { externalId: "LOC2", quantity: 2 }],
      heldByMarketplace: false,
    });
  });

  it("reads each order line with the location it ships from, the amount in paise, and skips a line missing what it needs", () => {
    const page = linesFrom(
      {
        hasMore: true,
        nextPageUrl: "/sellers/v3/shipments/filter?page=2",
        shipments: [
          {
            locationId: "LOC1",
            orderItems: [
              { orderId: "OD1", orderItemId: "OI1", sku: "HJB-1", quantity: 2, orderDate: "2026-10-29T10:00:00Z", priceComponents: { sellingPrice: 399.5 } },
              { orderId: "OD1", orderItemId: "OI2", quantity: 1 },
            ],
          },
        ],
      },
      "open",
    );
    expect(page.lines).toEqual([
      { orderId: "OD1", lineId: "OI1", sku: "HJB-1", quantity: 2, locationExternalId: "LOC1", state: "open", amountPaise: 39_950, orderedAt: new Date("2026-10-29T10:00:00Z") },
    ]);
    expect(page.next).toBe("/sellers/v3/shipments/filter?page=2");
  });
});
