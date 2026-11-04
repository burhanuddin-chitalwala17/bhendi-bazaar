import type { MarketplaceChannel } from "../channel-connection.types";
import type { ListingAttributes, ListingDetail, ListingSink, TokenSource } from "./listing-read";
import type { ListingStock, LocationCount, MarketplaceLocation, OrdersPage, StockListingRef } from "./stock";
import type { ListingRules } from "../platform-listing.types";
import type { CreateListingInput, ListingProblem, PageMatch, PublishAnswer, PublishChanges, PublishRef, StatusAnswer } from "./publish";

/**
 * One marketplace, behind the verbs channel-connectors needs (TRD D1). Later subfeatures add their
 * verbs here; a caller outside this domain never holds a token.
 */

export interface TokenGrant {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  /** Null when the marketplace does not say (Amazon: until re-approval, tracked from consent). */
  refreshTokenExpiresAt: Date | null;
}

/** What a marketplace sent back to the callback, read into one shape. */
export interface ConsentReturn {
  state: string | null;
  code: string | null;
  /** The shop declined, or closed the consent page. */
  declined: boolean;
  /** The marketplace's id for the shop, when it sends one (Amazon). */
  externalAccountId: string | null;
}

export interface MarketplaceProvider {
  readonly channel: MarketplaceChannel;
  /** Whether this deployment has the app's credentials at all. */
  configured(): boolean;
  consentUrl(state: string, redirectUri: string): string;
  readReturn(params: URLSearchParams): ConsentReturn;
  exchange(code: string, redirectUri: string, state: string | null): Promise<TokenGrant>;
  renew(refreshToken: string): Promise<TokenGrant>;
  /** One cheap read proving the access works. Changes nothing on the marketplace (Q13). */
  check(accessToken: string): Promise<void>;
  /** At most this many connected shops, while a marketplace limits an unlisted app (R10). */
  readonly connectionCap: number | null;
  /**
   * Read every listing the shop has (channel-import). Changes nothing on the marketplace. Reports the
   * account id when it learns it and each batch as it arrives, through the sink.
   */
  readListings(token: TokenSource, externalAccountId: string | null, sink: ListingSink): Promise<void>;

  /** One listing's type, attributes and product details, read now (marketplace-facts D1). */
  listingAttributes(
    token: TokenSource,
    externalAccountId: string | null,
    listing: { sku: string; externalId: string | null },
  ): Promise<ListingAttributes>;

  /** The account's pickup locations (inventory-sync D1). */
  readLocations(token: TokenSource, externalAccountId: string | null): Promise<MarketplaceLocation[]>;

  /** One listing's counts as the marketplace holds them now (inventory-sync D5, D6). */
  readStock(token: TokenSource, externalAccountId: string | null, listing: StockListingRef): Promise<ListingStock>;

  /** Order lines changed since the cursor, and the cursor to start from next (inventory-sync D4). */
  readOrders(token: TokenSource, externalAccountId: string | null, cursor: string | null): Promise<OrdersPage>;

  /** Send our counts for one listing, per marketplace location (inventory-sync D3). */
  setStock(token: TokenSource, externalAccountId: string | null, listing: StockListingRef, counts: readonly LocationCount[]): Promise<void>;

  /** What a listing here may change and its limits (channel-listings D6). */
  readonly listingRules: ListingRules;

  /** Features and description from a stored read, for "On Amazon now" (channel-listings Q9). */
  theirsFromRead(read: ListingAttributes): { features?: string[]; description?: string };

  /** Send only what changed on one listing (marketplace-publish D1, D2). */
  publishListing(token: TokenSource, externalAccountId: string | null, ref: PublishRef, changes: PublishChanges): Promise<PublishAnswer>;

  /** One listing as the marketplace holds it now (marketplace-publish D5). */
  listingStatus(token: TokenSource, externalAccountId: string | null, ref: PublishRef): Promise<StatusAnswer>;

  /**
   * Every listing on the account the marketplace says has an error now (marketplace-publish Q23), in as
   * few calls as it allows; empty where its answer comes only with a send. A listing not returned is clean.
   */
  listingProblems(token: TokenSource, externalAccountId: string | null): Promise<ListingProblem[]>;

  /** Pages already on the marketplace for a product; empty where it cannot create (marketplace-publish D6). */
  findPages(token: TokenSource, externalAccountId: string | null, query: { barcode: string | null; keywords: string }): Promise<PageMatch[]>;

  /** Create a listing, or only check it with `preview` (marketplace-publish D6, Q9). */
  createListing(token: TokenSource, externalAccountId: string | null, input: CreateListingInput, options: { preview: boolean }): Promise<PublishAnswer>;

  /** The variation themes a type allows, for a family's own page (marketplace-publish D7). */
  variationThemes(token: TokenSource, externalAccountId: string | null, marketplaceType: string): Promise<string[]>;

  /** One listing's title, description and photos, read now (product-merge D1). */
  listingDetail(
    token: TokenSource,
    externalAccountId: string | null,
    listing: { sku: string; externalId: string | null },
  ): Promise<ListingDetail>;
}

/** The marketplace refused our credentials; retrying will not help. The shop must reconnect. */
export class MarketplaceAuthError extends Error {
  constructor(readonly reason: "rejected" | "expired" | "revoked") {
    super(`Marketplace refused the credentials (${reason})`);
    this.name = "MarketplaceAuthError";
  }
}

/** The marketplace did not answer, or answered with a server error; trying later may work. */
export class MarketplaceUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super(`Marketplace unavailable${status ? ` (HTTP ${status})` : ""}`);
    this.name = "MarketplaceUnavailableError";
  }
}

/**
 * The marketplace refused this request itself (a 4xx other than auth or rate limit): the same call
 * fails the same way however often it is retried. `step` names the call, never its ids or body.
 */
export class MarketplaceRequestError extends Error {
  constructor(
    readonly status: number,
    readonly step: string,
  ) {
    super(`Marketplace refused the request (${step}, HTTP ${status})`);
    this.name = "MarketplaceRequestError";
  }
}

/** A `fetch` that gives up after ten seconds (D1) and turns network failure into "unavailable". */
export async function marketplaceFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    throw new MarketplaceUnavailableError(null);
  }
}
