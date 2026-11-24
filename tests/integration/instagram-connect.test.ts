/**
 * Connecting Instagram against a real database, with Instagram's answers stubbed at the transport
 * (connect-instagram unit 1): a business account connects with its token sealed and webhooks asked
 * for (A1); a personal account stores nothing (A3); another shop's account and a different account
 * on reconnect are refused (A4); a state for another channel or a refused sign-in connects nothing.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const IG_ID = `1784${RUN}`;

type Answer = { status: number; body: unknown };
function transport(answers: Record<string, Answer | (() => Answer)>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(answers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected call ${url}`);
    const answer = typeof answers[key] === "function" ? (answers[key] as () => Answer)() : (answers[key] as Answer);
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
  };
  return { fn, calls };
}

const happy = (overrides: Record<string, Answer> = {}) =>
  transport({
    "/oauth/access_token": { status: 200, body: { access_token: "IGAAshort-token-value", user_id: IG_ID } },
    "/access_token": { status: 200, body: { access_token: "IGAAlong-lived-token-value", token_type: "bearer", expires_in: 5_184_000 } },
    "/me?": { status: 200, body: { user_id: IG_ID, username: "zarahijab", account_type: "BUSINESS" } },
    "/me/subscribed_apps": { status: 200, body: { success: true } },
    ...overrides,
  });

describe.skipIf(!isDisposableDb)("Instagram connect (local db)", () => {
  let orgId = "";
  let otherOrgId = "";
  let userId = "";

  beforeAll(async () => {
    ({ orgId, otherOrgId, userId } = await ensureFixtures());
    vi.stubEnv("SOCIAL_CONNECT", "instagram");
    vi.stubEnv("META_INSTAGRAM_APP_ID", "1000000001");
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", "instagram-connect-secret-long");
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "instagram-connect-verify-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("HOME_BRAND_ORG_ID", orgId);
  });

  afterEach(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] }, channel: "instagram" } });
  });

  afterAll(() => vi.unstubAllEnvs());

  async function service(t: ReturnType<typeof transport>) {
    const { instagramConnectService } = await import("@server/channels/instagram-connect.service");
    const { instagramLogin } = await import("@server/channels/providers/meta/instagram-login");
    const { createGraphClient } = await import("@server/channels/providers/meta/graph-client");
    const { instagramAppSecret } = await import("@server/channels/providers/meta/settings");
    return instagramConnectService(instagramLogin(createGraphClient({ transport: t.fn, appSecret: instagramAppSecret })));
  }

  async function stateFor(org: string, purpose: "connect" | "reconnect" = "connect", channel = "instagram") {
    const { signConnectState, verifyConnectState } = await import("@server/channels/connect-state");
    const check = verifyConnectState(signConnectState({ orgId: org, userId, channel: channel as "instagram", purpose }));
    if (!check.ok) throw new Error("state did not verify");
    return check.state;
  }

  const row = async (org: string) => {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.channelConnection.findUnique({ where: { orgId_channel: { orgId: org, channel: "instagram" } } });
  };

  it("A1: the consent link asks Instagram for exactly the four business permissions, signed state attached", async () => {
    const ig = await service(happy());
    const start = await ig.start(orgId, userId);
    expect("redirectTo" in start).toBe(true);
    const url = new URL((start as { redirectTo: string }).redirectTo);
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages",
    );
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/channels/instagram/callback");
    expect(ig.readReturn(new URLSearchParams({ state: url.searchParams.get("state")!, code: "c#_" })).check.ok).toBe(true);
  });

  it("A1: a business account connects; the token is stored sealed, never plain, and webhooks are asked for", async () => {
    const t = happy();
    const ig = await service(t);
    expect(await ig.complete(await stateFor(orgId), { code: "CODE", declined: false })).toBe("connected");
    const stored = await row(orgId);
    expect(stored).toMatchObject({ state: "CONNECTED", externalAccountId: IG_ID, refreshToken: null, connectedById: userId });
    expect(stored?.accessToken).toMatch(/^v\d+:/);
    expect(JSON.stringify(stored)).not.toContain("IGAAlong");
    expect(stored!.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86_400_000);
    expect(t.calls.some((c) => c.url.includes("/me/subscribed_apps") && c.init.method === "POST")).toBe(true);
    // The token travels in the header, never in a query string a log could keep.
    for (const c of t.calls) expect(c.url).not.toContain("IGAA");
  });

  it("A3: a personal account stores nothing and asks for no webhooks", async () => {
    const t = happy({ "/me?": { status: 200, body: { user_id: IG_ID, username: "me", account_type: "PERSONAL" } } });
    const ig = await service(t);
    expect(await ig.complete(await stateFor(orgId), { code: "CODE", declined: false })).toBe("personal");
    expect(await row(orgId)).toBeNull();
    expect(t.calls.some((c) => c.url.includes("subscribed_apps"))).toBe(false);
  });

  it("A4: an account another shop holds is refused, and nothing is stored for this shop", async () => {
    const ig = await service(happy());
    expect(await ig.complete(await stateFor(otherOrgId), { code: "CODE", declined: false })).toBe("connected");
    expect(await ig.complete(await stateFor(orgId), { code: "CODE", declined: false })).toBe("other_shop");
    expect(await row(orgId)).toBeNull();
  });

  it("A4: a reconnect that signs in with a different account is refused; the connected one stays", async () => {
    const ig = await service(happy());
    expect(await ig.complete(await stateFor(orgId), { code: "CODE", declined: false })).toBe("connected");
    const other = await service(happy({ "/me?": { status: 200, body: { user_id: `${IG_ID}9`, username: "another", account_type: "MEDIA_CREATOR" } } }));
    expect(await other.complete(await stateFor(orgId, "reconnect"), { code: "CODE", declined: false })).toBe("different_account");
    expect((await row(orgId))?.externalAccountId).toBe(IG_ID);
  });

  it("a refused sign-in, an expired code and a silent Instagram each connect nothing, with their own outcome", async () => {
    const ig = await service(happy());
    expect(await ig.complete(await stateFor(orgId), { code: null, declined: true })).toBe("cancelled");
    const expired = await service(happy({ "/oauth/access_token": { status: 400, body: { error: { message: "x", type: "OAuthException", code: 190 } } } }));
    expect(await expired.complete(await stateFor(orgId), { code: "OLD", declined: false })).toBe("expired");
    const down = await service(happy({ "/oauth/access_token": { status: 503, body: {} } }));
    expect(await down.complete(await stateFor(orgId), { code: "CODE", declined: false })).toBe("unreachable");
    expect(await row(orgId)).toBeNull();
  });

  it("A2: a state signed for a marketplace is never spent on Instagram", async () => {
    const ig = await service(happy());
    expect(await ig.complete(await stateFor(orgId, "connect", "amazon"), { code: "CODE", declined: false })).toBe("expired");
    expect(await row(orgId)).toBeNull();
  });

  it("a shop without Social selling cannot start or finish a connect", async () => {
    vi.stubEnv("HOME_BRAND_ORG_ID", "");
    const { prisma } = await import("@server/shared/prisma");
    // Another suite may have switched every feature on for this fixture shop.
    await prisma.orgFeature.deleteMany({ where: { orgId: otherOrgId, feature: "social_selling" } });
    try {
      const ig = await service(happy());
      const { FeatureLockedError } = await import("@server/shared/domain-error");
      await expect(ig.start(otherOrgId, userId)).rejects.toBeInstanceOf(FeatureLockedError);
      await expect(ig.complete(await stateFor(otherOrgId), { code: "CODE", declined: false })).rejects.toBeInstanceOf(FeatureLockedError);
      expect(await row(otherOrgId)).toBeNull();
    } finally {
      vi.stubEnv("HOME_BRAND_ORG_ID", orgId);
    }
  });
});
