import type { MarketplaceChannel } from "../channel-connection.types";
import type { ListingSink, TokenSource } from "./listing-read";

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

/** A `fetch` that gives up after ten seconds (D1) and turns network failure into "unavailable". */
export async function marketplaceFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    throw new MarketplaceUnavailableError(null);
  }
}
