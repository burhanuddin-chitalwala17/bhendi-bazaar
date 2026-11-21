import type { MarketplaceChannel } from "./channel-connection.types";

/**
 * A product's listing on one marketplace as the shop means it (channel-listings) and its publish
 * (marketplace-publish): closed sets and the DTOs the screens are handed.
 */

/** The six fields a platform listing has, the same for every marketplace (channel-listings Q3, D2). */
export const LISTING_FIELD = {
  TITLE: "title",
  PRICE: "price",
  PHOTOS: "photos",
  FEATURES: "features",
  DESCRIPTION: "description",
  LISTED: "listed",
} as const;
export type ListingField = (typeof LISTING_FIELD)[keyof typeof LISTING_FIELD];
export const LISTING_FIELDS: readonly ListingField[] = Object.values(LISTING_FIELD);

/** A listing's six values; price in paise (Invariant 3), photos as product media ids in order. */
export interface ListingValues {
  title: string;
  price: number;
  photos: string[];
  features: string[];
  description: string;
  listed: boolean;
}

/** Only the fields changed for one marketplace (channel-listings D1). */
export type ListingOverrides = Partial<ListingValues>;

/** What is in flight, never whether the listing is live (marketplace-publish Q4). */
export const PUBLISH_STATE = {
  IDLE: "idle",
  SENT: "sent",
  CHECKING: "checking",
  ATTENTION: "attention",
  UNANSWERED: "unanswered",
} as const;
export type PublishState = (typeof PUBLISH_STATE)[keyof typeof PUBLISH_STATE];

/** How a listing not yet on the marketplace is created (marketplace-publish Q7). */
export const CREATE_MODE = { OFFER: "offer", NEW: "new" } as const;
export type CreateMode = (typeof CREATE_MODE)[keyof typeof CREATE_MODE];

/** A marketplace's complaint, on our field when it names one (marketplace-publish Q6, D9). */
export interface ListingIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field: ListingField | null;
  /** The marketplace's own name for what it complains of; absent on issues stored before Q24. */
  attribute?: string | null;
  /** What that is in our terms, when the marketplace's provider can tell (marketplace-publish Q24). */
  need?: IssueNeed | null;
}

/** What a complaint is about in our terms, said by the marketplace's provider (marketplace-publish Q24). */
export const ISSUE_NEED = {
  BRAND: "brand", BRAND_NAME: "brand_name", MRP: "mrp",
  /** A barcode, or the brand's exemption from one: only the shop has either (2026-11-09: it was raised as a request). */
  BARCODE: "barcode",
} as const;
export type IssueNeed = (typeof ISSUE_NEED)[keyof typeof ISSUE_NEED];

/** Where a complaint is fixed (marketplace-publish Q24): the brand, the MRP, a fact on the product, or the admin. */
export const LISTING_FIX = { BRAND: "brand", MRP: "mrp", FACTS: "facts", ADMIN: "admin" } as const;
export type ListingFix = (typeof LISTING_FIX)[keyof typeof LISTING_FIX];
export interface ListingFixDTO {
  kind: ListingFix;
  /** What to fill, as the shop reads it. */
  names: string[];
}

/** Home's line for listings a marketplace says need a fix (marketplace-publish Q23). */
export interface ListingProblemsAttentionDTO {
  channel: MarketplaceChannel;
  label: string;
  problems: number;
  suppressed: number;
}

/** What a marketplace lets us write and the limits it sets, declared in its provider (channel-listings D6). */
export interface ListingRules {
  writable: readonly ListingField[];
  limits: { title: number | null; feature: number | null; description: number | null };
  maxPhotos: number;
  /** Prices go out in whole rupees, rounded down (channel-listings Q13). */
  wholeRupees: boolean;
  photo: { minPx: number | null; formats: readonly string[] };
  /** Whether a product can be put on it from here (marketplace-publish Q7, Q12). */
  canCreate: boolean;
  /** Where the shop changes what we cannot write, named in copy. */
  editIn: string;
  /** It takes an unbranded listing a shop with no registered brand can use (setup-requests Q35). */
  genericBrand: boolean;
}

/** Where a listing stands, as one word for the screens (marketplace-publish ux.md status matrix). */
export const LISTING_STATUS = {
  DRAFT: "draft",
  WAITING: "waiting",
  SENT: "sent",
  CHECKING: "checking",
  LIVE: "live",
  PAUSED: "paused",
  ATTENTION: "attention",
  LIVE_REFUSED: "live_refused",
  UNANSWERED: "unanswered",
} as const;
export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

export interface ListingStatusDTO {
  status: ListingStatus;
  waiting: number;
  issues: number;
  /** ISO: when it was sent (sent, checking) or last checked (live). */
  at: string | null;
  nextCheckAt: string | null;
}

export interface ListingPhotoDTO {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  /** The marketplace's photo rule this one misses, when it misses one. */
  warning: "small" | "format" | null;
}

/** What the marketplace shows now, from the last read (channel-listings Q9). */
export interface TheirValuesDTO {
  title: string | null;
  price: number | null;
  features: string[] | null;
  description: string | null;
  readAt: string | null;
}

/** The listing screen (channel-listings ux.md). */
export interface ListingScreenDTO {
  id: string;
  version: number;
  channel: MarketplaceChannel;
  label: string;
  productId: string;
  productName: string;
  externalId: string | null;
  values: ListingValues;
  own: Record<ListingField, boolean>;
  product: ListingValues;
  theirs: TheirValuesDTO;
  rules: ListingRules;
  photos: ListingPhotoDTO[];
  locked: { mrpPaise: number | null; barcode: string | null; brand: string | null; stock: number };
  /** The shop lists here as Generic: its brand isn't registered on this marketplace (setup-requests Q35). */
  generic: boolean;
  status: ListingStatusDTO;
  waitingFields: ListingField[];
  issues: ListingIssue[];
  /** The issues came from the daily look, not a send (marketplace-publish Q23): whether it is hidden from shoppers. */
  marketplaceProblems: { suppressed: boolean } | null;
  /** Each complaint grouped by where it is fixed (Q24). */
  fixes: ListingFixDTO[];
  /** Complaints with no field on this page and no fix we can name: shown in the marketplace's words. */
  otherIssues: ListingIssue[];
  /** What Amazon shows when it differs from what was sent (marketplace-publish Q14). */
  showing: { title: string | null; mainImageUrl: string | null } | null;
  /** For a listing not yet on the marketplace: how it will be made, and what the marketplace still needs. */
  draft: { mode: CreateMode; targetExternalId: string | null; marketplaceType: string | null; stillNeeds: string[] } | null;
}

/** One marketplace on the product's On marketplaces block (channel-listings ux.md). */
export interface ProductListingSummaryDTO {
  channel: MarketplaceChannel;
  status: ListingStatusDTO | null;
  canCreate: boolean;
}

/** A value as the review shows it: text, a price in paise, photo addresses, points, on sale. */
export type ReviewValue = string | number | boolean | string[];

/** One change on the review, old against new (marketplace-publish R1, Q13). */
export interface ReviewChangeDTO {
  field: ListingField;
  /** What was last sent, or null for a listing not yet on the marketplace. */
  from: ReviewValue | null;
  to: ReviewValue;
  /** A price more than 30% away from what is live (Q13): marked, never refused. */
  big: boolean;
}

export interface ReviewListingDTO {
  id: string;
  version: number;
  productId: string | null;
  name: string;
  status: ListingStatusDTO;
  /** A create rather than an edit: the whole listing goes. */
  creating: boolean;
  changes: ReviewChangeDTO[];
}

/** Review and publish (marketplace-publish ux.md). */
export interface ReviewDTO {
  channel: MarketplaceChannel;
  label: string;
  listings: ReviewListingDTO[];
  totalChanges: number;
  /** Listings left out because their last send is still waiting on the marketplace. */
  sending: number;
}

/** Why a reviewed listing was not sent (D3). */
export const PUBLISH_REFUSAL = {
  /** Edited, removed or claimed since the review. */
  CHANGED: "changed",
  /** Its last send has no answer yet. */
  SENDING: "sending",
  /** Nothing the marketplace takes differs from what it has. */
  NOTHING: "nothing",
} as const;
export type PublishRefusal = (typeof PUBLISH_REFUSAL)[keyof typeof PUBLISH_REFUSAL];

/** What a publish did: how many were sent, and each refused listing with its reason (D3). */
export interface PublishResultDTO {
  sent: number;
  refused: Array<{ id: string; reason: PublishRefusal }>;
}
