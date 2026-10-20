import {
  MarketplaceAuthError,
  MarketplaceUnavailableError,
  marketplaceFetch,
  type ConsentReturn,
  type MarketplaceProvider,
  type TokenGrant,
} from "../marketplace-provider";

/**
 * Flipkart's third-party authorization, as INTEGRATIONS.md records it: the token call is a GET with
 * Basic auth, a refresh within 21 days of expiry returns a new refresh token, and nothing names the
 * shop that consented (decision Q2).
 */

const HOST = "https://api.flipkart.net/oauth-service/oauth";

const env = () => ({
  appId: process.env.FLIPKART_APP_ID?.trim() ?? "",
  appSecret: process.env.FLIPKART_APP_SECRET?.trim() ?? "",
});

const basic = () => {
  const { appId, appSecret } = env();
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;
};

interface FlipkartTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
}

async function token(params: Record<string, string>, previousRefresh: string | null): Promise<TokenGrant> {
  const response = await marketplaceFetch(`${HOST}/token?${new URLSearchParams(params).toString()}`, {
    method: "GET",
    headers: { authorization: basic(), accept: "application/json" },
  });
  if (response.status >= 500 || response.status === 429) throw new MarketplaceUnavailableError(response.status);

  const body = (await response.json().catch(() => ({}))) as FlipkartTokenResponse;
  if (!response.ok || !body.access_token) {
    // A refused refresh is the 180-day lapse or a removed app; either way the shop reconnects.
    throw new MarketplaceAuthError(previousRefresh ? "expired" : "rejected");
  }
  const refreshToken = body.refresh_token ?? previousRefresh;
  if (!refreshToken) throw new MarketplaceAuthError("rejected");
  const now = Date.now();
  return {
    accessToken: body.access_token,
    accessTokenExpiresAt: new Date(now + (body.expires_in ?? 0) * 1000),
    refreshToken,
    refreshTokenExpiresAt: body.refresh_token_expires_in ? new Date(now + body.refresh_token_expires_in * 1000) : null,
  };
}

export const flipkartProvider: MarketplaceProvider = {
  channel: "flipkart",
  connectionCap: null,

  configured() {
    const { appId, appSecret } = env();
    return Boolean(appId && appSecret);
  },

  consentUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: env().appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "Seller_Api",
      state,
    });
    return `${HOST}/authorize?${params.toString()}`;
  },

  readReturn(params): ConsentReturn {
    const code = params.get("code");
    return {
      state: params.get("state"),
      code,
      declined: Boolean(params.get("error")) || !code,
      externalAccountId: null,
    };
  },

  async exchange(code, redirectUri, state) {
    return await token(
      { redirect_uri: redirectUri, grant_type: "authorization_code", code, ...(state ? { state } : {}) },
      null,
    );
  },

  async renew(refreshToken) {
    return await token({ grant_type: "refresh_token", refresh_token: refreshToken }, refreshToken);
  },

  async check(accessToken) {
    const params = new URLSearchParams({ token_type: "access", token: accessToken });
    const response = await marketplaceFetch(`${HOST}/token/expiry?${params.toString()}`, {
      method: "GET",
      headers: { authorization: basic(), accept: "application/json" },
    });
    if (response.status >= 500 || response.status === 429) throw new MarketplaceUnavailableError(response.status);
    if (!response.ok) throw new MarketplaceAuthError("rejected");
    const body = (await response.json().catch(() => ({}))) as { expired?: boolean };
    if (body.expired !== false) throw new MarketplaceAuthError("rejected");
  },
};
