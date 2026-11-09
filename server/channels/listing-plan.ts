import {
  ISSUE_NEED,
  LISTING_FIELDS,
  LISTING_FIX,
  LISTING_STATUS,
  PUBLISH_STATE,
  type ListingField,
  type ListingFix,
  type ListingFixDTO,
  type ListingIssue,
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
  media: ReadonlyArray<{ id: string; ref: string }>;
}): ListingValues {
  return {
    title: product.name,
    price: product.price,
    // By address, which survives a product save; the media rows' ids are renewed by each save.
    photos: product.media.map((m) => m.ref),
    features: product.keyFeatures,
    description: product.description,
    listed: true,
  };
}

type Media = ReadonlyArray<{ id: string; ref: string }>;

/**
 * Photos stored before they were kept by address held media ids: an id the product still has becomes
 * its address; one it no longer has is unknown. Unknown in what was sent means it is read as what the
 * listing was made with (the product's photos), the same assumption a new listing starts from (Q2).
 */
function photosByAddress(o: ListingOverrides, media: Media | undefined, sent: boolean): ListingOverrides {
  if (!media || !o.photos) return o;
  const refs = new Set(media.map((m) => m.ref));
  const mapped = o.photos.map((p) => (refs.has(p) ? p : media.find((m) => m.id === p)?.ref ?? null));
  if (mapped.every((p): p is string => p !== null)) return { ...o, photos: mapped };
  return sent ? { ...o, photos: media.map((m) => m.ref) } : { ...o, photos: mapped.filter((p): p is string => p !== null) };
}

/** Reads a stored overrides column, keeping only well-formed keys: a malformed one inherits rather than breaks. */
export function parseOverrides(raw: unknown, media?: Media): ListingOverrides {
  return photosByAddress(readOverrides(raw), media, false);
}

function readOverrides(raw: unknown): ListingOverrides {
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
export function parseSent(raw: unknown, media?: Media): ListingOverrides | null {
  return raw && typeof raw === "object" ? photosByAddress(readOverrides(raw), media, true) : null;
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

/**
 * Fields the marketplace takes whose value differs from what was last sent: "changes waiting" (R8, R10).
 * A field the marketplace now complains of waits too, so fixing it, or sending it again as it is, goes
 * through the same review (marketplace-publish Q23).
 */
export function waitingFields(values: ListingValues, sent: ListingOverrides | null, writable: readonly ListingField[], resend: readonly ListingField[] = []): ListingField[] {
  return writable.filter((f) => !same(values[f], sent?.[f]) || resend.includes(f));
}

/** The fields a stored complaint names, errors only (Q23). */
export function complainedFields(problems: unknown): ListingField[] {
  if (!Array.isArray(problems)) return [];
  const fields = problems.flatMap((p) => (p && typeof p === "object" && (p as { severity?: unknown }).severity === "error" && typeof (p as { field?: unknown }).field === "string" ? [(p as { field: string }).field] : []));
  return LISTING_FIELDS.filter((f) => fields.includes(f));
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

/** A fact this marketplace's mapping fills an attribute from, and whether the product has answered it. */
export type FactFor = (attribute: string) => { label: string; answered: boolean } | null;

/** The name a shop reads for a complaint: the marketplace's own quoted name, else its attribute in words. */
function nameOf(issue: ListingIssue): string {
  const quoted = /'([^']+)'/.exec(issue.message)?.[1];
  if (quoted && !quoted.includes("_")) return quoted;
  const words = (issue.attribute ?? issue.code).replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Where each complaint is fixed (marketplace-publish Q24). The brand's details and the MRP go to where
 * they are kept; an attribute mapped to a fact the product leaves blank is that fact; anything else
 * on no field here is the admin's to add. A complaint pinned to a field stays on that field.
 */
export function fixesOf(issues: readonly ListingIssue[], hasMrp: boolean, factFor: FactFor): { fixes: ListingFixDTO[]; otherIssues: ListingIssue[] } {
  const names = new Map<ListingFix, Set<string>>();
  const add = (kind: ListingFix, name: string) => names.set(kind, (names.get(kind) ?? new Set()).add(name));
  const otherIssues: ListingIssue[] = [];
  for (const issue of issues) {
    if (issue.need === ISSUE_NEED.MRP && !hasMrp) add(LISTING_FIX.MRP, nameOf(issue));
    else if (issue.need === ISSUE_NEED.BRAND || issue.need === ISSUE_NEED.BRAND_NAME) add(LISTING_FIX.BRAND, nameOf(issue));
    // The barcode card says how (add one, or the brand's exemption); listed here it read as ours to fix.
    else if (issue.need === ISSUE_NEED.BARCODE) continue;
    else if (issue.field !== null) continue;
    else if (!issue.attribute) otherIssues.push(issue);
    else {
      const fact = factFor(issue.attribute);
      if (fact && !fact.answered) add(LISTING_FIX.FACTS, fact.label);
      else add(LISTING_FIX.ADMIN, nameOf(issue));
    }
  }
  const order = [LISTING_FIX.BRAND, LISTING_FIX.MRP, LISTING_FIX.FACTS, LISTING_FIX.ADMIN];
  return { fixes: order.flatMap((kind) => (names.has(kind) ? [{ kind, names: [...names.get(kind)!] }] : [])), otherIssues };
}
