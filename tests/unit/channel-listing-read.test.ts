// Reading a shop's marketplace listings (channel-import D4, D5, D7): what each marketplace's answers
// become, and which listing links to which product. Network is stubbed; payload shapes follow
// INTEGRATIONS.md's listing-read notes (checked 2026-10-21).
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listingFromReportRow,
  parseListingsReport,
  readAmazonListings,
} from "@server/channels/providers/amazon/amazon.listings";
import { listingsFromDetails, readFlipkartListings } from "@server/channels/providers/flipkart/flipkart.listings";
import { paiseFromRupees, retryBusy, type ListingSink } from "@server/channels/providers/listing-read";
import { MarketplaceAuthError } from "@server/channels/providers/marketplace-provider";
import { indexBySkuKey, productForListing, skuKey } from "@server/channels/listing-match";
import type { ReadListing } from "@server/channels/channel-listing.repository";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => fetchMock.mockReset());

/** Records what a read reports, in order. */
function recordingSink() {
  const events: Array<{ account: string } | { rows: ReadListing[]; done: number; total: number | null }> = [];
  const sink: ListingSink = {
    alive: async () => undefined,
    account: async (account) => void events.push({ account }),
    batch: async (rows, progress) => void events.push({ rows, ...progress }),
  };
  const rows = () => events.flatMap((e) => ("rows" in e ? e.rows : []));
  return { sink, events, rows };
}

describe("prices become paise by digits, never by float arithmetic (Invariant 3)", () => {
  it("reads rupee strings and numbers exactly", () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point; a Math.round would hide it, a floor would not.
    expect(paiseFromRupees("19.99")).toBe(1999);
    expect(paiseFromRupees(19.99)).toBe(1999);
    expect(paiseFromRupees("1,899.5")).toBe(189950);
    expect(paiseFromRupees("1899")).toBe(189900);
  });

  it("refuses what is not a price rather than guessing", () => {
    expect(paiseFromRupees("")).toBeNull();
    expect(paiseFromRupees("-5")).toBeNull();
    expect(paiseFromRupees("₹100")).toBeNull();
    expect(paiseFromRupees(null)).toBeNull();
  });
});

describe("Amazon's all-listings report (D4)", () => {
  const header = "item-name\tseller-sku\tprice\tquantity\tasin1\tstatus\tfulfillment-channel";

  it("reads a report with a byte-order mark, Windows line ends and a short row", () => {
    const text = `﻿${header}\r\nBlack Abaya\tABY-1\t1899.00\t9\tB0C1\tActive\tDEFAULT\r\nShort\tABY-2\r\n`;
    const rows = parseListingsReport(text);
    expect(rows).toHaveLength(2);
    expect(listingFromReportRow(rows[0])).toMatchObject({
      sku: "ABY-1",
      skuKey: "aby-1",
      externalId: "B0C1",
      pricePaise: 189900,
      quantity: 9,
      status: "LIVE",
    });
    expect(listingFromReportRow(rows[1])).toMatchObject({ sku: "ABY-2", pricePaise: null, quantity: null, status: null });
  });

  it("does not report Amazon-fulfilled stock as the shop's own", () => {
    const [row] = parseListingsReport(`${header}\nX\tFBA-1\t100\t40\tB0C2\tActive\tAMAZON_IN\n`);
    expect(listingFromReportRow(row)?.quantity).toBeNull();
  });

  it("reads the report, then groups children under their variation parent and drops the parent row (spec A9)", async () => {
    const report = [
      header,
      "Nida Abaya\tPARENT\t\t\tB0P\tActive\tDEFAULT",
      "Nida Abaya M\tABY-M\t1899\t3\tB0M\tActive\tDEFAULT",
      "Nida Abaya L\tABY-L\t1899\t0\tB0L\tInactive\tDEFAULT",
      "Hijab Pins\tPINS-24\t199\t50\tB0H\tActive\tDEFAULT",
    ].join("\n");
    const variation = (parentSkus: string[], childSkus: string[]) => [
      { relationships: [{ type: "VARIATION", parentSkus, childSkus, variationTheme: { theme: "SIZE_NAME" } }] },
    ];
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/reports/2021-06-30/reports")) return json({ reportId: "R1" });
      if (url.endsWith("/reports/2021-06-30/reports/R1")) return json({ processingStatus: "DONE", reportDocumentId: "D1" });
      if (url.endsWith("/reports/2021-06-30/documents/D1")) return json({ url: "https://s3.example/doc", compressionAlgorithm: "GZIP" });
      if (url === "https://s3.example/doc") return new Response(gzipSync(Buffer.from(report)));
      if (url.includes("/listings/2021-08-01/items/A1SHOP")) {
        return json({
          items: [
            { sku: "PARENT", summaries: [{ itemName: "Nida Abaya" }], relationships: variation([], ["ABY-M", "ABY-L"]) },
            { sku: "ABY-M", summaries: [{ mainImage: { link: "https://m.media-amazon.com/m.jpg" } }], relationships: variation(["PARENT"], []) },
            { sku: "ABY-L", summaries: [{}], relationships: variation(["PARENT"], []) },
            { sku: "PINS-24", summaries: [{}], relationships: [] },
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    const { sink, events, rows } = recordingSink();
    await readAmazonListings(async () => "TOKEN", "A1SHOP", sink);

    expect(events[0]).toEqual({ account: "A1SHOP" });
    expect(rows().map((r) => r.sku)).toEqual(["ABY-M", "ABY-L", "PINS-24"]);
    expect(rows()[0]).toMatchObject({ parentSku: "PARENT", parentTitle: "Nida Abaya", variationAxis: "size", imageUrl: "https://m.media-amazon.com/m.jpg" });
    expect(rows()[2]).toMatchObject({ parentSku: null, variationAxis: null });
  });

  it("refuses to read without the account it was connected with", async () => {
    await expect(readAmazonListings(async () => "TOKEN", null, recordingSink().sink)).rejects.toBeInstanceOf(MarketplaceAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Flipkart's three passes (D5, D6)", () => {
  it("sums stock over the shop's locations and takes the picture from product search", () => {
    const rows = listingsFromDetails(
      {
        available: {
          "KRT-1": {
            listing_id: "L1",
            product_id: "FSN1",
            product_title: "Kurta",
            listing_status: "ACTIVE",
            price: { selling_price: 799 },
            locations: [{ inventory: 4 }, { inventory: 6 }],
          },
          "GONE-1": {},
        },
      },
      new Map([["KRT-1", { imageUrl: "https://rukminim2.flixcart.com/k.jpg", name: null }]]),
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sku: "KRT-1", externalId: "FSN1", quantity: 10, pricePaise: 79900, status: "LIVE", imageUrl: "https://rukminim2.flixcart.com/k.jpg" });
  });

  it("names the account before writing any listing, so a second shop's account is refused first", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (url.endsWith("/listings/v3/product/search")) {
        return json({ listingData: body.internalState === "ACTIVE" && body.batchNo === 0 ? [{ sellerId: "FK-SHOP", sku: "KRT-1" }] : [] });
      }
      if (url.endsWith("/listings/v3/search")) return json({ listings: [{ sku_id: "KRT-1", product_id: "FSN1" }], has_more: false });
      if (url.endsWith("/listings/v3/details")) {
        return json({ available: { "KRT-1": { listing_id: "L1", product_id: "FSN1", listing_status: "ACTIVE", price: { selling_price: "799" } } } });
      }
      throw new Error(`unexpected ${url}`);
    });

    const { sink, events, rows } = recordingSink();
    await readFlipkartListings(async () => "TOKEN", null, sink);
    expect(events[0]).toEqual({ account: "FK-SHOP" });
    expect(rows().map((r) => r.sku)).toEqual(["KRT-1"]);
  });
});

describe("a refused credential is never retried", () => {
  it("throws the first auth failure at once", async () => {
    const call = vi.fn().mockRejectedValue(new MarketplaceAuthError("revoked"));
    await expect(retryBusy(call, 5, 1)).rejects.toBeInstanceOf(MarketplaceAuthError);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("linking by SKU (D7)", () => {
  const index = indexBySkuKey([
    { id: "p-abaya", sku: " ABY-BLK-M " },
    { id: "p-none", sku: null },
  ]);

  it("matches on SKU after trimming and ignoring case, and nothing looser (Q3)", () => {
    expect(productForListing({ skuKey: skuKey("aby-blk-m"), productId: null, unlinkedAt: null }, index)).toBe("p-abaya");
    expect(productForListing({ skuKey: skuKey("ABY-BLK"), productId: null, unlinkedAt: null }, index)).toBeNull();
  });

  it("never relinks a listing the owner unlinked, nor moves one already linked (Q5)", () => {
    expect(productForListing({ skuKey: "aby-blk-m", productId: null, unlinkedAt: new Date() }, index)).toBeNull();
    expect(productForListing({ skuKey: "aby-blk-m", productId: "p-other", unlinkedAt: null }, index)).toBeNull();
  });
});
