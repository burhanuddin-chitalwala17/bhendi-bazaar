import {
  MarketplaceAuthError,
  MarketplaceUnavailableError,
  marketplaceFetch,
  type ConsentReturn,
  type MarketplaceProvider,
  type TokenGrant,
} from "../marketplace-provider";
import { readAmazonListings, amazonListingDetail, amazonListingAttributes } from "./amazon.listings";
import { amazonLocations, amazonReadOrders, amazonReadStock, amazonSetStock } from "./amazon.stock";
import { AMAZON_LISTING_RULES, amazonCreate, amazonFindPages, amazonListingProblems, amazonListingStatus, amazonPublish, amazonTheirsFromRead, amazonVariationThemes, amazonTypeDefinition, amazonSearchTypes, amazonCatalogueType } from "./amazon.publish";

/**
 * Amazon's Selling Partner API, as INTEGRATIONS.md records it: website authorization through
 * Amazon's India consent page, tokens from Login with Amazon, the Europe endpoint for India.
 */

const CONSENT_URL = "https://sellercentral.amazon.in/apps/authorize/consent";
const TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const PARTICIPATIONS_URL = "https://sellingpartnerapi-eu.amazon.com/sellers/v1/marketplaceParticipations";

/**
 * Our app is unlisted on the Appstore (decision Q16): consent must carry `version=beta`, and Amazon
 * allows 25 shops. A fact about the app, not a switch; it changes once, when the listing is approved.
 */
const APP_LISTED = false;
const UNLISTED_CAP = 25;

const env = () => ({
  clientId: process.env.AMAZON_APP_ID?.trim() ?? "",
  clientSecret: process.env.AMAZON_APP_SECRET?.trim() ?? "",
  solutionId: process.env.AMAZON_SOLUTION_ID?.trim() ?? "",
});

interface LwaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

async function lwaToken(form: Record<string, string>, refreshed: boolean): Promise<TokenGrant> {
  const { clientId, clientSecret } = env();
  const response = await marketplaceFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, client_id: clientId, client_secret: clientSecret }).toString(),
  });
  if (response.status >= 500 || response.status === 429) throw new MarketplaceUnavailableError(response.status);

  const body = (await response.json().catch(() => ({}))) as LwaTokenResponse;
  if (!response.ok || !body.access_token) {
    // invalid_grant on a refresh means the shop removed our app or the year is up.
    throw new MarketplaceAuthError(refreshed && body.error === "invalid_grant" ? "revoked" : "rejected");
  }
  const refreshToken = body.refresh_token ?? form.refresh_token;
  if (!refreshToken) throw new MarketplaceAuthError("rejected");
  return {
    accessToken: body.access_token,
    accessTokenExpiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
    refreshToken,
    refreshTokenExpiresAt: null,
  };
}

export const amazonProvider: MarketplaceProvider = {
  channel: "amazon",
  connectionCap: APP_LISTED ? null : UNLISTED_CAP,
  readListings: readAmazonListings,
  listingDetail: amazonListingDetail,
  listingRules: AMAZON_LISTING_RULES,
  theirsFromRead: amazonTheirsFromRead,
  publishListing: amazonPublish,
  listingStatus: amazonListingStatus,
  listingProblems: amazonListingProblems,
  findPages: amazonFindPages,
  createListing: amazonCreate,
  variationThemes: amazonVariationThemes,
  typeDefinition: amazonTypeDefinition,
  catalogueType: amazonCatalogueType,
  searchTypes: amazonSearchTypes,
  listingAttributes: amazonListingAttributes,
  readLocations: amazonLocations,
  readStock: amazonReadStock,
  setStock: amazonSetStock,
  readOrders: amazonReadOrders,

  configured() {
    const { clientId, clientSecret, solutionId } = env();
    return Boolean(clientId && clientSecret && solutionId);
  },

  consentUrl(state, redirectUri) {
    const params = new URLSearchParams({ application_id: env().solutionId, state, redirect_uri: redirectUri });
    if (!APP_LISTED) params.set("version", "beta");
    return `${CONSENT_URL}?${params.toString()}`;
  },

  readReturn(params): ConsentReturn {
    const code = params.get("spapi_oauth_code");
    return {
      state: params.get("state"),
      code,
      declined: !code,
      externalAccountId: params.get("selling_partner_id"),
    };
  },

  async exchange(code, redirectUri) {
    return await lwaToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri }, false);
  },

  async renew(refreshToken) {
    return await lwaToken({ grant_type: "refresh_token", refresh_token: refreshToken }, true);
  },

  async check(accessToken) {
    const response = await marketplaceFetch(PARTICIPATIONS_URL, {
      method: "GET",
      headers: { "x-amz-access-token": accessToken, accept: "application/json" },
    });
    if (response.ok) return;
    if (response.status === 401 || response.status === 403) throw new MarketplaceAuthError("rejected");
    throw new MarketplaceUnavailableError(response.status);
  },
};
