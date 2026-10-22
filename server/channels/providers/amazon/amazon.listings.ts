import { gunzipSync } from "node:zlib";

import { LISTING_STATUS, type ListingStatus } from "../../channel-connection.types";
import type { ReadListing } from "../../channel-listing.repository";
import { skuKey } from "../../listing-match";
import {
  MarketplaceAuthError,
  MarketplaceRequestError,
  MarketplaceUnavailableError,
  marketplaceFetch,
} from "../marketplace-provider";
import {
  nonNegativeInt,
  pacer,
  paiseFromRupees,
  retryBusy,
  sleepFor,
  type ListingDetail,
  type ListingSink,
  type TokenSource,
} from "../listing-read";

/**
 * Reading every Amazon listing (channel-import D4): the all-listings report, because the Listings
 * search stops at 1,000 results, then the Listings API by SKU for the image and the variation parent.
 */

const HOST = "https://sellingpartnerapi-eu.amazon.com";
export const AMAZON_IN = "A21TJRUUN4KGV";
const REPORT_TYPE = "GET_MERCHANT_LISTINGS_ALL_DATA";
const REPORT_POLL_MS = 15_000;
const REPORT_TIMEOUT_MS = 30 * 60_000;
const ENRICH_BATCH = 20;

async function spApi(token: TokenSource, step: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await marketplaceFetch(`${HOST}${path}`, {
    ...init,
    headers: {
      "x-amz-access-token": await token(),
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (response.status === 401 || response.status === 403) throw new MarketplaceAuthError("rejected");
  if (response.status === 429 || response.status >= 500) throw new MarketplaceUnavailableError(response.status);
  if (!response.ok) throw new MarketplaceRequestError(response.status, `amazon ${step}`);
  return await response.json();
}

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** Amazon's report spells status in words; ours are three. */
export function statusFromReport(value: string | null): ListingStatus | null {
  const v = value?.toLowerCase();
  if (v === "active") return LISTING_STATUS.LIVE;
  if (v === "inactive") return LISTING_STATUS.INACTIVE;
  if (v === "incomplete") return LISTING_STATUS.INCOMPLETE;
  return null;
}

/** The report as rows keyed by its own header names. Tab-separated, one listing per line. */
export function parseListingsReport(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const header = lines[0].split("\t").map((name) => name.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

/** One report row as a listing, before enrichment. Self-fulfilled stock only; FBA stock is Amazon's. */
export function listingFromReportRow(row: Record<string, string>): ReadListing | null {
  const sku = str(row["seller-sku"]);
  if (!sku) return null;
  const fba = (row["fulfillment-channel"] ?? "").toUpperCase().startsWith("AMAZON");
  return {
    sku,
    skuKey: skuKey(sku),
    externalId: str(row["asin1"]) ?? str(row["product-id"]),
    title: str(row["item-name"]),
    imageUrl: str(row["image-url"]),
    status: statusFromReport(str(row["status"])),
    pricePaise: paiseFromRupees(row["price"]),
    quantity: fba ? null : nonNegativeInt(row["quantity"]),
    parentSku: null,
    parentTitle: null,
    variationAxis: null,
  };
}

async function downloadReport(token: TokenSource, sink: ListingSink): Promise<string> {
  const created = obj(
    await retryBusy(() =>
      spApi(token, "reports/create", "/reports/2021-06-30/reports", {
        method: "POST",
        body: JSON.stringify({ reportType: REPORT_TYPE, marketplaceIds: [AMAZON_IN] }),
      }),
    ),
  );
  const reportId = str(created.reportId);
  if (!reportId) throw new MarketplaceUnavailableError(null);

  const deadline = Date.now() + REPORT_TIMEOUT_MS;
  for (;;) {
    const report = obj(await retryBusy(() => spApi(token, "reports/get", `/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`)));
    const status = str(report.processingStatus);
    // Amazon cancels a report with nothing in it: an account with no listings.
    if (status === "CANCELLED") return "";
    if (status === "FATAL") throw new MarketplaceUnavailableError(null);
    const documentId = str(report.reportDocumentId);
    if (status === "DONE" && documentId) {
      const document = obj(await retryBusy(() => spApi(token, "documents/get", `/reports/2021-06-30/documents/${encodeURIComponent(documentId)}`)));
      const url = str(document.url);
      if (!url) throw new MarketplaceUnavailableError(null);
      // A pre-signed address: no token goes with it.
      const file = await marketplaceFetch(url, { method: "GET" });
      if (!file.ok) throw new MarketplaceUnavailableError(file.status);
      const bytes = Buffer.from(await file.arrayBuffer());
      const raw = str(document.compressionAlgorithm) === "GZIP" ? gunzipSync(bytes) : bytes;
      return new TextDecoder("utf-8").decode(raw);
    }
    if (Date.now() > deadline) throw new MarketplaceUnavailableError(null);
    await sink.alive();
    await sleepFor(REPORT_POLL_MS);
  }
}

interface Enrichment {
  imageUrl: string | null;
  itemName: string | null;
  parentSkus: string[];
  childSkus: string[];
  axis: string | null;
}

/** The Listings API's view of up to 20 SKUs: image, name and variation relationships. */
export function enrichmentFromItems(items: unknown): Map<string, Enrichment> {
  const out = new Map<string, Enrichment>();
  for (const raw of Array.isArray(items) ? items : []) {
    const item = obj(raw);
    const sku = str(item.sku);
    if (!sku) continue;
    const summary = obj(Array.isArray(item.summaries) ? item.summaries[0] : null);
    const relationships = (Array.isArray(item.relationships) ? item.relationships : []).flatMap((group) =>
      Array.isArray(obj(group).relationships) ? (obj(group).relationships as unknown[]) : [],
    );
    const variation = relationships.map(obj).filter((r) => r.type === "VARIATION");
    const parentSkus = variation.flatMap((r) => (Array.isArray(r.parentSkus) ? r.parentSkus.filter((s): s is string => typeof s === "string") : []));
    const childSkus = variation.flatMap((r) => (Array.isArray(r.childSkus) ? r.childSkus.filter((s): s is string => typeof s === "string") : []));
    const theme = variation.map((r) => obj(r.variationTheme)).find((t) => str(t.theme));
    out.set(sku, {
      imageUrl: str(obj(summary.mainImage).link),
      itemName: str(summary.itemName),
      parentSkus,
      childSkus,
      axis: theme ? axisWords(str(theme.theme)) : null,
    });
  }
  return out;
}

/** "SIZE_NAME/COLOR_NAME" → "size and colour", as a person would say it. */
export function axisWords(theme: string | null): string | null {
  if (!theme) return null;
  const words = theme
    .toLowerCase()
    .split(/[/_]/)
    .filter((w) => w && w !== "name")
    .map((w) => (w === "color" ? "colour" : w));
  return [...new Set(words)].join(" and ") || null;
}

async function enrich(token: TokenSource, accountId: string, skus: string[], pace: () => Promise<void>) {
  const all = new Map<string, Enrichment>();
  for (let i = 0; i < skus.length; i += ENRICH_BATCH) {
    const batch = skus.slice(i, i + ENRICH_BATCH);
    const query = new URLSearchParams({
      marketplaceIds: AMAZON_IN,
      identifiers: batch.join(","),
      identifiersType: "SKU",
      includedData: "summaries,relationships",
      pageSize: String(ENRICH_BATCH),
    });
    await pace();
    const body = obj(
      await retryBusy(() => spApi(token, "listings/search", `/listings/2021-08-01/items/${encodeURIComponent(accountId)}?${query.toString()}`)),
    );
    for (const [sku, data] of enrichmentFromItems(body.items)) all.set(sku, data);
  }
  return all;
}

export async function readAmazonListings(token: TokenSource, accountId: string | null, sink: ListingSink): Promise<void> {
  // Amazon names the account on the consent redirect (connectors Q17); it is the connection's already.
  if (!accountId) throw new MarketplaceAuthError("rejected");
  await sink.account(accountId);

  const rows = parseListingsReport(await downloadReport(token, sink))
    .map(listingFromReportRow)
    .filter((row): row is ReadListing => row !== null);
  const total = rows.length;
  if (total === 0) {
    await sink.batch([], { done: 0, total: 0 });
    return;
  }
  await sink.batch([], { done: 0, total });

  const pace = pacer(5);
  let done = 0;
  for (let i = 0; i < rows.length; i += ENRICH_BATCH * 5) {
    const slice = rows.slice(i, i + ENRICH_BATCH * 5);
    const enriched = await enrich(token, accountId, slice.map((row) => row.sku), pace);
    const parents = [...new Set(slice.flatMap((row) => enriched.get(row.sku)?.parentSkus ?? []))].filter((sku) => !enriched.has(sku));
    const parentData = parents.length > 0 ? await enrich(token, accountId, parents, pace) : new Map<string, Enrichment>();

    const out: ReadListing[] = [];
    for (const row of slice) {
      const data = enriched.get(row.sku);
      // A variation parent is a header over its children, never a row of its own (Q9).
      if (data && data.childSkus.length > 0 && data.parentSkus.length === 0) continue;
      const parentSku = data?.parentSkus[0] ?? null;
      const parent = parentSku ? (enriched.get(parentSku) ?? parentData.get(parentSku)) : undefined;
      out.push({
        ...row,
        imageUrl: data?.imageUrl ?? row.imageUrl,
        title: row.title ?? data?.itemName ?? null,
        parentSku,
        parentTitle: parent?.itemName ?? null,
        variationAxis: parent?.axis ?? data?.axis ?? null,
      });
    }
    done += slice.length;
    await sink.batch(out, { done, total });
  }
}

const PHOTO_ORDER = ["MAIN", "PT01", "PT02", "PT03", "PT04", "PT05", "PT06", "PT07", "PT08"];

/** The listing's own text: `item_name`, and `product_description` with its `bullet_point`s. */
export function textFromAttributes(attributes: unknown): { title: string | null; description: string | null } {
  const attrs = obj(attributes);
  const values = (key: string) =>
    (Array.isArray(attrs[key]) ? (attrs[key] as unknown[]) : []).map((entry) => str(obj(entry).value)).filter((v): v is string => v !== null);
  const bullets = values("bullet_point");
  const parts = [values("product_description")[0] ?? null, bullets.length > 0 ? bullets.map((b) => `• ${b}`).join("\n") : null];
  const description = parts.filter((p): p is string => p !== null).join("\n\n");
  return { title: values("item_name")[0] ?? null, description: description || null };
}

/** Every image on the product page (Q26): the largest of each variant, main first, at most nine. */
export function photosFromCatalog(body: unknown): string[] {
  const forMarket = (Array.isArray(obj(body).images) ? (obj(body).images as unknown[]) : [])
    .map(obj)
    .find((entry) => entry.marketplaceId === AMAZON_IN);
  const best = new Map<string, { link: string; area: number }>();
  for (const raw of Array.isArray(forMarket?.images) ? (forMarket.images as unknown[]) : []) {
    const image = obj(raw);
    const variant = str(image.variant);
    const link = str(image.link);
    if (!variant || !link) continue;
    const area = (Number(image.width) || 0) * (Number(image.height) || 0);
    const current = best.get(variant);
    if (!current || area > current.area) best.set(variant, { link, area });
  }
  return PHOTO_ORDER.flatMap((variant) => {
    const hit = best.get(variant);
    return hit ? [hit.link] : [];
  });
}

export async function amazonListingDetail(
  token: TokenSource,
  accountId: string | null,
  listing: { sku: string; externalId: string | null },
): Promise<ListingDetail> {
  if (!accountId) throw new MarketplaceAuthError("rejected");
  const query = new URLSearchParams({ marketplaceIds: AMAZON_IN, includedData: "summaries,attributes" });
  const item = obj(
    await retryBusy(() =>
      spApi(token, "listings/get", `/listings/2021-08-01/items/${encodeURIComponent(accountId)}/${encodeURIComponent(listing.sku)}?${query.toString()}`),
    ),
  );
  const asin = str(obj(Array.isArray(item.summaries) ? item.summaries[0] : null).asin) ?? listing.externalId;
  const text = textFromAttributes(item.attributes);
  if (!asin) return { ...text, photoUrls: [] };
  const catalog = await retryBusy(() =>
    spApi(token, "catalog/get", `/catalog/2022-04-01/items/${encodeURIComponent(asin)}?${new URLSearchParams({ marketplaceIds: AMAZON_IN, includedData: "images" }).toString()}`),
  );
  return { ...text, photoUrls: photosFromCatalog(catalog) };
}
