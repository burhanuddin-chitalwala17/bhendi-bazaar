// Amazon and Flipkart as INTEGRATIONS.md records them (channel-connectors TRD D1, D8): consent
// links, token exchange and renewal, the health check, and how each failure is classed. A refused
// credential means "reconnect"; a server error or timeout means "try later". Network is stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amazonProvider } from "@server/channels/providers/amazon/amazon.provider";
import { flipkartProvider } from "@server/channels/providers/flipkart/flipkart.provider";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "@server/channels/providers/marketplace-provider";

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(process.env, {
    AMAZON_APP_ID: "amzn1.application-oa2-client.test",
    AMAZON_APP_SECRET: "amazon-secret",
    AMAZON_SOLUTION_ID: "amzn1.sp.solution.test",
    FLIPKART_APP_ID: "fk-app",
    FLIPKART_APP_SECRET: "fk-secret",
  });
});
afterEach(() => {
  fetchMock.mockReset();
  for (const name of ["AMAZON_APP_ID", "AMAZON_APP_SECRET", "AMAZON_SOLUTION_ID", "FLIPKART_APP_ID", "FLIPKART_APP_SECRET"]) {
    delete process.env[name];
  }
});

describe("Amazon", () => {
  it("links to India's consent page as an unlisted app, with the 25-shop cap (Q16)", () => {
    const url = new URL(amazonProvider.consentUrl("STATE", "https://bhendi-bazaar.com/api/channels/amazon/callback"));
    expect(url.origin + url.pathname).toBe("https://sellercentral.amazon.in/apps/authorize/consent");
    expect(url.searchParams.get("application_id")).toBe("amzn1.sp.solution.test");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("version")).toBe("beta");
    expect(amazonProvider.connectionCap).toBe(25);
  });

  it("is unavailable without all three credentials (Q10)", () => {
    delete process.env.AMAZON_SOLUTION_ID;
    expect(amazonProvider.configured()).toBe(false);
  });

  it("reads the return, including who the seller account is", () => {
    const back = amazonProvider.readReturn(
      new URLSearchParams({ spapi_oauth_code: "CODE", state: "S", selling_partner_id: "A1B2C3" }),
    );
    expect(back).toEqual({ state: "S", code: "CODE", declined: false, externalAccountId: "A1B2C3" });
    expect(amazonProvider.readReturn(new URLSearchParams({ state: "S" })).declined).toBe(true);
  });

  it("exchanges a code for tokens", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
    const grant = await amazonProvider.exchange("CODE", "https://x/cb", null);
    expect(grant).toMatchObject({ accessToken: "AT", refreshToken: "RT", refreshTokenExpiresAt: null });
    const [, init] = fetchMock.mock.calls[0];
    expect(String(init.body)).toContain("grant_type=authorization_code");
  });

  it("classes a refused renewal as revoked, so the shop is asked to reconnect", async () => {
    fetchMock.mockResolvedValueOnce(json(400, { error: "invalid_grant" }));
    await expect(amazonProvider.renew("RT")).rejects.toMatchObject({ name: "MarketplaceAuthError", reason: "revoked" });
  });

  it("keeps the refresh token when a renewal does not restate it", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access_token: "AT2", expires_in: 3600 }));
    expect((await amazonProvider.renew("RT")).refreshToken).toBe("RT");
  });

  it("checks access with one read; 401 means reconnect, 503 means try later", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { payload: [] }));
    await expect(amazonProvider.check("AT")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(json(401, {}));
    await expect(amazonProvider.check("AT")).rejects.toBeInstanceOf(MarketplaceAuthError);
    fetchMock.mockResolvedValueOnce(json(503, {}));
    await expect(amazonProvider.check("AT")).rejects.toBeInstanceOf(MarketplaceUnavailableError);
  });

  it("turns a network failure into 'try later'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(amazonProvider.check("AT")).rejects.toBeInstanceOf(MarketplaceUnavailableError);
  });
});

describe("Flipkart", () => {
  it("links to its authorize page for the Seller_Api scope", () => {
    const url = new URL(flipkartProvider.consentUrl("STATE", "https://bhendi-bazaar.com/api/channels/flipkart/callback"));
    expect(url.origin + url.pathname).toBe("https://api.flipkart.net/oauth-service/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("fk-app");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(flipkartProvider.connectionCap).toBeNull();
  });

  it("names no account on return (Q2), and reads an error as declined", () => {
    expect(flipkartProvider.readReturn(new URLSearchParams({ code: "C", state: "S" })).externalAccountId).toBeNull();
    expect(flipkartProvider.readReturn(new URLSearchParams({ error: "access_denied", state: "S" })).declined).toBe(true);
  });

  it("exchanges with a GET and Basic auth, and records both lifetimes", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { access_token: "AT", refresh_token: "RT", expires_in: 5183999, refresh_token_expires_in: 15552000 }),
    );
    const grant = await flipkartProvider.exchange("C", "https://x/cb", "S");
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from("fk-app:fk-secret").toString("base64")}`);
    expect(String(url)).toContain("grant_type=authorization_code");
    expect(grant.refreshTokenExpiresAt).not.toBeNull();
  });

  it("takes a new refresh token when renewal returns one, else keeps the old (hazard 1)", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access_token: "AT2", refresh_token: "RT2", expires_in: 60 }));
    expect((await flipkartProvider.renew("RT1")).refreshToken).toBe("RT2");
    fetchMock.mockResolvedValueOnce(json(200, { access_token: "AT3", expires_in: 60 }));
    expect((await flipkartProvider.renew("RT1")).refreshToken).toBe("RT1");
  });

  it("classes a refused renewal as expired", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "invalid_grant" }));
    await expect(flipkartProvider.renew("RT")).rejects.toMatchObject({ reason: "expired" });
  });

  it("checks access through the token-expiry endpoint", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { expired: false, token_type: "access", expires_in: 100 }));
    await expect(flipkartProvider.check("AT")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(json(200, { expired: true }));
    await expect(flipkartProvider.check("AT")).rejects.toBeInstanceOf(MarketplaceAuthError);
  });
});
