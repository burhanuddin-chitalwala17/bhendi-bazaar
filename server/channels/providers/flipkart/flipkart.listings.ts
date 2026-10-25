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
  NO_DETAILS,
  nonNegativeInt,
  paiseFromRupees,
  retryBusy,
  type ListingAttributes,
  type ListingDetail,
  type ListingProductDetails,
  type ListingSink,
  type TokenSource,
} from "../listing-read";

/**
 * Reading every Flipkart listing (channel-import D5): its product search first, which names the
 * account id and carries images; then the listing search for every SKU and FSN; then listing details,
 * ten at a time, for title, price, status and stock. Prices are read as rupees (unconfirmed by the docs).
 */

const HOST = "https://api.flipkart.net/sellers";
const PRODUCT_STATES = ["ACTIVE", "INACTIVE", "READY_FOR_ACTIVATION", "INACTIVATED_BY_FLIPKART", "ARCHIVED"] as const;
const PRODUCT_BATCH = 20;
const DETAILS_BATCH = 10;
const MAX_PAGES = 10_000;

async function call(token: TokenSource, path: string, body: unknown): Promise<unknown> {
  const response = await marketplaceFetch(`${HOST}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) throw new MarketplaceAuthError("rejected");
  if (response.status === 429 || response.status >= 500) throw new MarketplaceUnavailableError(response.status);
  if (!response.ok) throw new MarketplaceRequestError(response.status, `flipkart ${path}`);
  return await response.json();
}

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function statusFromFlipkart(listingStatus: string | null, archived: string | null): ListingStatus | null {
  if (archived === "ARCHIVED") return LISTING_STATUS.INACTIVE;
  if (listingStatus === "ACTIVE") return LISTING_STATUS.LIVE;
  if (listingStatus === "INACTIVE") return LISTING_STATUS.INACTIVE;
  return null;
}

interface CatalogueEntry {
  imageUrl: string | null;
  name: string | null;
}

/** One page of product search: the account id and each SKU's image and name. */
export function readProductPage(body: unknown): { accountId: string | null; entries: Map<string, CatalogueEntry>; count: number } {
  const data = obj(body);
  const list = Array.isArray(data.listingData) ? data.listingData.map(obj) : [];
  const entries = new Map<string, CatalogueEntry>();
  let accountId: string | null = null;
  for (const item of list) {
    accountId ??= str(item.sellerId);
    const sku = str(item.sku);
    if (sku) entries.set(sku, { imageUrl: str(item.product_image_url), name: str(item.product_name) });
  }
  return { accountId, entries, count: list.length };
}

/** Listing details for up to ten SKUs, as listings. Stock is summed over the shop's locations. */
export function listingsFromDetails(body: unknown, catalogue: Map<string, CatalogueEntry>, fsnBySku: Map<string, string>): ReadListing[] {
  const available = obj(obj(body).available);
  const out: ReadListing[] = [];
  for (const [sku, raw] of Object.entries(available)) {
    const item = obj(raw);
    if (!str(item.listing_id) && !str(item.product_id)) continue;
    const price = obj(item.price);
    const locations = Array.isArray(item.locations) ? item.locations.map(obj) : [];
    const stock = locations.reduce<number | null>((sum, location) => {
      const n = nonNegativeInt(location.inventory);
      return n === null ? sum : (sum ?? 0) + n;
    }, null);
    const fromCatalogue = catalogue.get(sku);
    out.push({
      sku,
      skuKey: skuKey(sku),
      externalId: str(item.product_id) ?? fsnBySku.get(sku) ?? null,
      title: str(item.product_title) ?? fromCatalogue?.name ?? null,
      imageUrl: fromCatalogue?.imageUrl ?? null,
      status: statusFromFlipkart(str(item.listing_status), str(item.archived_status)),
      pricePaise: paiseFromRupees(price.flipkart_selling_price ?? price.selling_price),
      quantity: stock,
      // Flipkart's listing calls name no variant group (Q15).
      parentSku: null,
      parentTitle: null,
      variationAxis: null,
    });
  }
  return out;
}

export async function readFlipkartListings(token: TokenSource, _known: string | null, sink: ListingSink): Promise<void> {
  // 1. Product search: the account first, and every image and name it offers. Our app is answered
  // 404 here (checked 2026-10-21), so without it the read goes on with no account and no images (Q20).
  const catalogue = new Map<string, CatalogueEntry>();
  let accountReported = false;
  let productSearch = true;
  for (const state of PRODUCT_STATES) {
    if (!productSearch) break;
    for (let batchNo = 0; batchNo < MAX_PAGES; batchNo++) {
      let body: unknown;
      try {
        body = await retryBusy(() => call(token, "/listings/v3/product/search", { batchNo, internalState: state }));
      } catch (error) {
        if (error instanceof MarketplaceRequestError && error.status === 404) {
          productSearch = false;
          break;
        }
        throw error;
      }
      const page = readProductPage(body);
      if (page.accountId && !accountReported) {
        await sink.account(page.accountId);
        accountReported = true;
      }
      for (const [sku, entry] of page.entries) catalogue.set(sku, entry);
      await sink.alive();
      if (page.count < PRODUCT_BATCH) break;
    }
  }

  // 2. Listing search: every SKU and FSN, 500 a page.
  const fsnBySku = new Map<string, string>();
  let pageId: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const body = obj(await retryBusy(() => call(token, "/listings/v3/search", { filters: {}, page_id: pageId })));
    for (const raw of Array.isArray(body.listings) ? body.listings : []) {
      const item = obj(raw);
      const sku = str(item.sku_id);
      if (sku) fsnBySku.set(sku, str(item.product_id) ?? "");
    }
    await sink.alive();
    pageId = str(body.next_page_id);
    if (body.has_more !== true || !pageId) break;
  }
  const skus = [...new Set([...fsnBySku.keys(), ...catalogue.keys()])];
  // Product search answered but named no account: no row is written before the one-shop check (D6).
  if (productSearch && !accountReported && skus.length > 0) throw new MarketplaceUnavailableError(null);
  const total = skus.length;
  await sink.batch([], { done: 0, total });

  // 3. Details, ten at a time.
  let done = 0;
  for (let i = 0; i < skus.length; i += DETAILS_BATCH * 10) {
    const slice = skus.slice(i, i + DETAILS_BATCH * 10);
    const rows: ReadListing[] = [];
    for (let j = 0; j < slice.length; j += DETAILS_BATCH) {
      const batch = slice.slice(j, j + DETAILS_BATCH);
      rows.push(...listingsFromDetails(await retryBusy(() => call(token, "/listings/v3/details", { sku_ids: batch })), catalogue, fsnBySku));
    }
    done += slice.length;
    await sink.batch(rows, { done, total });
  }
}

/** Flipkart's listing details carry a title but no description or photos (checked 2026-10-21; Q20, Q27). */
export async function flipkartListingDetail(
  token: TokenSource,
  _accountId: string | null,
  listing: { sku: string; externalId: string | null },
): Promise<ListingDetail> {
  const body = obj(await retryBusy(() => call(token, "/listings/v3/details", { sku_ids: [listing.sku] })));
  const item = obj(obj(body.available)[listing.sku]);
  return { title: str(item.product_title), description: null, photoUrls: [] };
}

/** Text from a value that may be a string, a list of strings or a list of objects with a name. */
function labelText(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === "string" ? x : str(obj(x).name) ?? str(obj(x).value) ?? str(obj(x).address))).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  const o = obj(v);
  return str(o.name) ?? str(o.value) ?? str(o.address) ?? null;
}

/**
 * Flipkart's product details from a listing (Q4, Q17): its listing details carry MRP, HSN, the parcel
 * and the label (manufacturer, importer, packer, origin), though no type or attributes.
 */
export function flipkartDetails(item: unknown): ListingProductDetails {
  const i = obj(item);
  const label = obj(i.address_label);
  const pkg = obj(Array.isArray(i.packages) ? i.packages[0] : null);
  const weight = Number(pkg.weight);
  const dims = obj(pkg.dimensions);
  const [length, width, height] = ["length", "breadth", "height"].map((k) => Number(dims[k]));
  const countries = labelText(label.countries_of_origin);
  return {
    ...NO_DETAILS,
    weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    dimensionsCm: [length, width, height].every((n) => Number.isFinite(n) && n > 0) ? { length, width, height } : null,
    hsn: str(obj(i.tax).hsn),
    mrpPaise: paiseFromRupees(obj(i.price).mrp),
    countryOfOrigin: countries && /^[A-Z]{2}$/.test(countries) ? countries : null,
    manufacturer: labelText(label.manufacturer_details),
    packer: labelText(label.packer_details),
    importer: labelText(label.importer_details),
  };
}

export async function flipkartListingAttributes(
  token: TokenSource,
  _accountId: string | null,
  listing: { sku: string; externalId: string | null },
): Promise<ListingAttributes> {
  const body = obj(await retryBusy(() => call(token, "/listings/v3/details", { sku_ids: [listing.sku] })));
  // No type and no attributes: Flipkart keeps those on the product, which our app cannot read yet (Q4).
  return { type: null, attributes: {}, details: flipkartDetails(obj(obj(body.available)[listing.sku])) };
}
