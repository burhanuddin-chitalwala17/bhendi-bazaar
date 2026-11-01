import {
  LISTING_FIELDS,
  LISTING_STATUS,
  PUBLISH_STATE,
  type ListingField,
  type ListingOverrides,
  type ListingStatusDTO,
  type ListingValues,
} from "./platform-listing.types";

/**
 * Computing a listing from its product (channel-listings D3, D5) and where it stands
 * (marketplace-publish Q4). Pure: the same for every marketplace.
 */

/** The product as every listing inherits it (D7): its name, price, photos, features, description, on sale. */
export function masterValues(product: {
  name: string;
  price: number;
  description: string;
  keyFeatures: string[];
  media: ReadonlyArray<{ id: string }>;
}): ListingValues {
  return {
    title: product.name,
    price: product.price,
    photos: product.media.map((m) => m.id),
    features: product.keyFeatures,
    description: product.description,
    listed: true,
  };
}

/** Reads a stored overrides column, keeping only well-formed keys: a malformed one inherits rather than breaks. */
export function parseOverrides(raw: unknown): ListingOverrides {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: ListingOverrides = {};
  if (typeof o.title === "string") out.title = o.title;
  if (typeof o.price === "number" && Number.isInteger(o.price) && o.price > 0) out.price = o.price;
  if (Array.isArray(o.photos) && o.photos.every((p) => typeof p === "string")) out.photos = o.photos as string[];
  if (Array.isArray(o.features) && o.features.every((f) => typeof f === "string")) out.features = o.features as string[];
  if (typeof o.description === "string") out.description = o.description;
  if (typeof o.listed === "boolean") out.listed = o.listed;
  return out;
}

/** Reads a stored `sent` snapshot the same way; null when never sent. */
export function parseSent(raw: unknown): ListingOverrides | null {
  return raw && typeof raw === "object" ? parseOverrides(raw) : null;
}

/**
 * The listing as the marketplace gets it: the product with the listing's own values over it (D1).
 * A photo the product no longer has drops out (D8); an override left with none falls back.
 */
export function computeListing(master: ListingValues, overrides: ListingOverrides): ListingValues {
  const photos = overrides.photos?.filter((id) => master.photos.includes(id));
  return {
    ...master,
    ...overrides,
    photos: photos && photos.length > 0 ? photos : master.photos,
  };
}

/** Which fields are the listing's own (Q8). */
export function ownFields(overrides: ListingOverrides): Record<ListingField, boolean> {
  return Object.fromEntries(LISTING_FIELDS.map((f) => [f, overrides[f] !== undefined])) as Record<ListingField, boolean>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Fields the marketplace takes whose value differs from what was last sent: "changes waiting" (R8, R10). */
export function waitingFields(values: ListingValues, sent: ListingOverrides | null, writable: readonly ListingField[]): ListingField[] {
  return writable.filter((f) => !same(values[f], sent?.[f]));
}

/**
 * The overrides a listing starts with (Q2): wherever the marketplace's copy is known and differs from
 * the product, the marketplace's is kept, so nothing changes there until the shop chooses.
 */
export function seedOverrides(master: ListingValues, theirs: Partial<ListingValues>): ListingOverrides {
  const out: ListingOverrides = {};
  for (const f of LISTING_FIELDS) {
    const value = theirs[f];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (!same(value, master[f])) (out as Record<string, unknown>)[f] = value;
  }
  return out;
}

/** The fields of `values` the marketplace takes, as the snapshot a seed or an accepted send records. */
export function snapshot(values: ListingValues, fields: readonly ListingField[]): ListingOverrides {
  return Object.fromEntries(fields.map((f) => [f, values[f]])) as ListingOverrides;
}

/** Flipkart's whole rupees, rounded down (channel-listings Q13): paise in, paise out. */
export const toWholeRupees = (paise: number) => Math.floor(paise / 100) * 100;

/** Where a listing stands, from what is in flight, what waits and what was last accepted (publish Q4). */
export function listingStatus(input: {
  onMarketplace: boolean;
  publishState: string;
  waiting: number;
  issues: number;
  listed: boolean;
  publishedAt: Date | null;
  checkedAt: Date | null;
  nextCheckAt: Date | null;
}): ListingStatusDTO {
  const at = (d: Date | null) => (d ? d.toISOString() : null);
  const base = { waiting: input.waiting, issues: input.issues, nextCheckAt: at(input.nextCheckAt) };
  switch (input.publishState) {
    case PUBLISH_STATE.SENT:
      return { ...base, status: LISTING_STATUS.SENT, at: at(input.publishedAt) };
    case PUBLISH_STATE.CHECKING:
      return { ...base, status: LISTING_STATUS.CHECKING, at: at(input.publishedAt) };
    case PUBLISH_STATE.UNANSWERED:
      return { ...base, status: LISTING_STATUS.UNANSWERED, at: at(input.publishedAt) };
    case PUBLISH_STATE.ATTENTION:
      return { ...base, status: input.onMarketplace ? LISTING_STATUS.LIVE_REFUSED : LISTING_STATUS.ATTENTION, at: at(input.checkedAt) };
  }
  if (!input.onMarketplace) return { ...base, status: LISTING_STATUS.DRAFT, at: null };
  if (input.waiting > 0) return { ...base, status: LISTING_STATUS.WAITING, at: at(input.checkedAt) };
  return { ...base, status: input.listed ? LISTING_STATUS.LIVE : LISTING_STATUS.PAUSED, at: at(input.checkedAt) };
}
