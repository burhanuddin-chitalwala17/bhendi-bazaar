import { retryBusy, rupeesFromPaise, type TokenSource } from "../listing-read";
import { MarketplaceRequestError } from "../marketplace-provider";
import type { PublishAnswer, PublishChanges, PublishRef, StatusAnswer } from "../publish";
import { LISTING_FIELD, type ListingField, type ListingIssue, type ListingRules } from "../../platform-listing.types";
import { flipkartCall } from "./flipkart.stock";

/**
 * What Flipkart lets us write (channel-listings Q4): price, in whole rupees, and on sale or paused.
 * Title, photos and text belong to its catalogue and change in Seller Hub; no product can be created
 * by API (parent Q33). Checked 2026-11-02.
 */
export const FLIPKART_LISTING_RULES: ListingRules = {
  writable: [LISTING_FIELD.PRICE, LISTING_FIELD.LISTED],
  limits: { title: null, feature: null, description: null },
  maxPhotos: 0,
  wholeRupees: true,
  photo: { minPx: null, formats: [] },
  canCreate: false,
  editIn: "Flipkart Seller Hub",
  genericBrand: false,
};

/** Flipkart's read carries no features or description we could show. */
export const flipkartTheirsFromRead = (): { features?: string[]; description?: string } => ({});

// ── Publishing (marketplace-publish D2, Q12) ─────────────────────────────────────────────────

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const rupees = (paise: number) => rupeesFromPaise(paise, true);

/** Flipkart answers each SKU on its own, with status and errors (FMSAPI); anything but success is a refusal. */
export function flipkartAnswer(body: unknown, sku: string, field: ListingField): { ok: boolean; issues: ListingIssue[] } {
  const answer = obj(obj(body)[sku]);
  const status = str(answer.status)?.toUpperCase() ?? null;
  const errors = [...(Array.isArray(answer.errors) ? answer.errors : []), ...(Array.isArray(answer.attribute_errors) ? answer.attribute_errors : [])].map(obj);
  const issues: ListingIssue[] = errors.map((e) => ({
    code: str(e.code) ?? "flipkart",
    message: (str(e.description) ?? str(e.message) ?? "Flipkart turned this change down.").slice(0, 300),
    severity: str(e.severity)?.toUpperCase() === "WARNING" ? "warning" : "error",
    field,
  }));
  const ok = status === "SUCCESS" || status === "WARNING";
  return { ok, issues: ok ? issues.filter((i) => i.severity === "warning") : issues.length > 0 ? issues : [{ code: status ?? "unknown", message: "Flipkart turned this change down.", severity: "error", field }] };
}

async function details(token: TokenSource, sku: string): Promise<Record<string, unknown>> {
  return obj(obj(obj(await retryBusy(() => flipkartCall(token, "/listings/v3/details", { method: "POST", body: { sku_ids: [sku] } }))).available)[sku]);
}

/**
 * Price by its own update, in whole rupees rounded down with the product's MRP (or Flipkart's when the
 * product has none); on sale or paused by the listing update, sent back whole as read. Final answers.
 */
export async function flipkartPublish(token: TokenSource, _account: string | null, ref: PublishRef, changes: PublishChanges): Promise<PublishAnswer> {
  if (!ref.externalId) return { accepted: [], issues: [{ code: "no_fsn", message: "This listing has no Flipkart product id yet.", severity: "error", field: null }], decidesLater: false };
  const accepted: ListingField[] = [];
  const issues: ListingIssue[] = [];
  const current = changes.price !== undefined || changes.listed !== undefined ? await details(token, ref.sku) : {};
  try {
    if (changes.price !== undefined) {
      const theirMrp = Number(obj(current.price).mrp);
      const mrp = changes.mrpPaise !== null ? rupees(changes.mrpPaise) : Number.isFinite(theirMrp) ? theirMrp : rupees(changes.price);
      const body = { [ref.sku]: { product_id: ref.externalId, price: { mrp, selling_price: rupees(changes.price), currency: "INR" } } };
      const answer = flipkartAnswer(await retryBusy(() => flipkartCall(token, "/listings/v3/update/price", { method: "POST", body })), ref.sku, LISTING_FIELD.PRICE);
      if (answer.ok) accepted.push(LISTING_FIELD.PRICE);
      issues.push(...answer.issues);
    }
    if (changes.listed !== undefined) {
      const listing = { ...current, product_id: ref.externalId, listing_status: changes.listed ? "ACTIVE" : "INACTIVE" };
      const answer = flipkartAnswer(await retryBusy(() => flipkartCall(token, "/listings/v3/update", { method: "POST", body: { [ref.sku]: listing } })), ref.sku, LISTING_FIELD.LISTED);
      if (answer.ok) accepted.push(LISTING_FIELD.LISTED);
      issues.push(...answer.issues);
    }
  } catch (error) {
    if (!(error instanceof MarketplaceRequestError)) throw error;
    issues.push({ code: "request", message: "Flipkart turned this request down.", severity: "error", field: null });
  }
  return { accepted, issues, decidesLater: false };
}

/** The listing on Flipkart now: on sale or not. Flipkart reports no reason for an inactive listing. */
export async function flipkartListingStatus(token: TokenSource, _account: string | null, ref: PublishRef): Promise<StatusAnswer> {
  const item = await details(token, ref.sku);
  const status = str(item.listing_status)?.toUpperCase() ?? null;
  return { found: Object.keys(item).length > 0, live: status === null ? null : status === "ACTIVE", issues: [], showing: { title: null, mainImageUrl: null } };
}
