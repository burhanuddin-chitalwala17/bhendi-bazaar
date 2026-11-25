/**
 * Connecting WhatsApp from Meta's Embedded Signup against a real database, Meta stubbed at the
 * transport (connect-whatsapp unit 1): a valid result claims the number Setting up with its token
 * sealed and the setup job queued; a replayed, stale or forged result connects nothing (A3); a
 * number another shop holds, and a different number on reconnect, are refused (A4).
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const WABA = `10${RUN}`;
const PHONE = `20${RUN}`;
const OTHER_PHONE = `21${RUN}`;

type Answer = { status: number; body: unknown };
function transport(answers: Record<string, Answer>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(answers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected call ${url}`);
    return new Response(JSON.stringify(answers[key].body), { status: answers[key].status, headers: { "content-type": "application/json" } });
  };
  return { fn, calls };
}

const meta = (overrides: Record<string, Answer> = {}, phones = [PHONE, OTHER_PHONE]) =>
  transport({
    "/oauth/access_token": { status: 200, body: { access_token: "EAAGbusiness-token-value", token_type: "bearer" } },
    "/phone_numbers": { status: 200, body: { data: phones.map((id) => ({ id })) } },
    ...overrides,
  });

describe.skipIf(!isDisposableDb)("WhatsApp sign-up (local db)", () => {
  let orgId = "";
  let otherOrgId = "";
  let userId = "";

  beforeAll(async () => {
    ({ orgId, otherOrgId, userId } = await ensureFixtures());
    vi.stubEnv("SOCIAL_CONNECT", "whatsapp");
    vi.stubEnv("META_APP_ID", "1000000002");
    vi.stubEnv("META_APP_SECRET", "whatsapp-signup-secret-long");
    vi.stubEnv("META_SIGNUP_CONFIG_ID", "1000000003");
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "whatsapp-signup-verify-token");
    vi.stubEnv("HOME_BRAND_ORG_ID", orgId);
    const { prisma } = await import("@server/shared/prisma");
    await prisma.orgFeature.upsert({
      where: { orgId_feature: { orgId: otherOrgId, feature: "social_selling" } },
      create: { orgId: otherOrgId, feature: "social_selling", enabled: true },
      update: { enabled: true },
    });
  });

  afterEach(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] }, channel: "whatsapp" } });
  });

  afterAll(() => vi.unstubAllEnvs());

  async function service(t: ReturnType<typeof transport>) {
    const { whatsappConnectService } = await import("@server/channels/whatsapp-connect.service");
    const { embeddedSignup } = await import("@server/channels/providers/meta/embedded-signup");
    const { createGraphClient } = await import("@server/channels/providers/meta/graph-client");
    return whatsappConnectService(embeddedSignup(createGraphClient({ transport: t.fn })));
  }

  /** Opens an attempt as the page does, and reads its state back as the route does. */
  async function attempt(wa: Awaited<ReturnType<typeof service>>, org: string) {
    const start = await wa.start(org, userId);
    if (!("state" in start)) throw new Error(`start answered ${start.result}`);
    const check = wa.readState(start.state);
    if (!check.ok) throw new Error("state did not verify");
    return check.state;
  }

  const result = (phoneId = PHONE, businessId = WABA) => ({ code: "CODE", businessId, phoneId, kind: "coexistence" as const });

  const row = async (org: string) => {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.channelConnection.findUnique({ where: { orgId_channel: { orgId: org, channel: "whatsapp" } } });
  };

  const setupJobs = async (connectionId: string) => {
    const { prisma } = await import("@server/shared/prisma");
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM pgboss.job WHERE data->>'type' = 'channels.whatsapp-setup' AND data->'payload'->>'connectionId' = ${connectionId}`;
    return Number(n);
  };

  it("opens an attempt with the app's public ids and a signed state; nothing is connected yet", async () => {
    const wa = await service(meta());
    const start = await wa.start(orgId, userId);
    expect(start).toMatchObject({ appId: "1000000002", configId: "1000000003" });
    expect(await row(orgId)).toMatchObject({ state: "DISCONNECTED", accessToken: null, externalPhoneId: null });
  });

  it("a valid result claims the number Setting up, token sealed, setup queued (behaviour: Setting up)", async () => {
    const t = meta();
    const wa = await service(t);
    expect(await wa.complete(await attempt(wa, orgId), result())).toBe("connected");
    const stored = await row(orgId);
    expect(stored).toMatchObject({
      state: "SETTING_UP",
      externalBusinessId: WABA,
      externalPhoneId: PHONE,
      externalAccountKind: "coexistence",
      refreshToken: null,
      connectedById: userId,
      signupNonce: null,
    });
    expect(stored?.accessToken).toMatch(/^v\d+:/);
    expect(JSON.stringify(stored)).not.toContain("EAAGbusiness");
    expect(await setupJobs(stored!.id)).toBe(1);
    // The token travels in the header, never in a query string a log could keep.
    for (const c of t.calls) expect(c.url).not.toContain("EAAG");
  });

  it("A3: a replayed result connects nothing, and Meta is not asked a second time", async () => {
    const t = meta();
    const wa = await service(t);
    const state = await attempt(wa, orgId);
    expect(await wa.complete(state, result())).toBe("connected");
    const calls = t.calls.length;
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "whatsapp" } });
    expect(await wa.complete(state, result())).toBe("expired");
    expect(t.calls.length).toBe(calls);
    expect(await row(orgId)).toBeNull();
  });

  it("A3: a result from an older attempt connects nothing once a newer one has opened", async () => {
    const wa = await service(meta());
    const older = await attempt(wa, orgId);
    await attempt(wa, orgId);
    expect(await wa.complete(older, result())).toBe("expired");
    expect((await row(orgId))?.state).toBe("DISCONNECTED");
  });

  it("A3: a forged result, ids the token does not reach, connects nothing", async () => {
    const wa = await service(meta({}, [OTHER_PHONE]));
    expect(await wa.complete(await attempt(wa, orgId), result())).toBe("expired");
    expect(await row(orgId)).toMatchObject({ state: "DISCONNECTED", accessToken: null, externalPhoneId: null });
  });

  it("A3: a forged account id, one the token cannot reach, connects nothing and says start again", async () => {
    const wa = await service(meta({ "/phone_numbers": { status: 400, body: { error: { message: "x", code: 100 } } } }));
    expect(await wa.complete(await attempt(wa, orgId), result(PHONE, "999"))).toBe("expired");
    expect(await row(orgId)).toMatchObject({ state: "DISCONNECTED", accessToken: null, externalPhoneId: null });
  });

  it("a shop whose setup failed may try again with another number", async () => {
    const wa = await service(meta());
    expect(await wa.complete(await attempt(wa, orgId), result())).toBe("connected");
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.updateMany({ where: { orgId, channel: "whatsapp" }, data: { state: "SETUP_FAILED" } });
    expect(await wa.complete(await attempt(wa, orgId), result(OTHER_PHONE))).toBe("connected");
    expect(await row(orgId)).toMatchObject({ state: "SETTING_UP", externalPhoneId: OTHER_PHONE });
  });

  it("A3: a forged state connects nothing", async () => {
    const wa = await service(meta());
    await attempt(wa, orgId);
    const { signConnectState } = await import("@server/channels/connect-state");
    const token = signConnectState({ orgId, userId, channel: "whatsapp", purpose: "connect" });
    const [encoded, mac] = token.split(".");
    expect(wa.readState(`${encoded}.${mac.slice(0, -2)}xx`).ok).toBe(false);
    // Signed by us but with a nonce no attempt holds: still nothing.
    const stray = wa.readState(token);
    if (!stray.ok) throw new Error("state did not verify");
    expect(await wa.complete(stray.state, result())).toBe("expired");
  });

  it("A4: a number another shop holds is refused, and nothing is stored for this shop", async () => {
    const wa = await service(meta());
    expect(await wa.complete(await attempt(wa, otherOrgId), result())).toBe("connected");
    expect(await wa.complete(await attempt(wa, orgId), result())).toBe("other_shop");
    expect(await row(orgId)).toMatchObject({ state: "DISCONNECTED", accessToken: null });
  });

  it("A4: a reconnect with a different number is refused; the connected one stays", async () => {
    const wa = await service(meta());
    expect(await wa.complete(await attempt(wa, orgId), result())).toBe("connected");
    expect(await wa.complete(await attempt(wa, orgId), result(OTHER_PHONE))).toBe("different_account");
    expect((await row(orgId))?.externalPhoneId).toBe(PHONE);
  });

  it("an expired code and a silent Meta each connect nothing, with their own outcome", async () => {
    const expired = await service(meta({ "/oauth/access_token": { status: 400, body: { error: { message: "x", code: 190 } } } }));
    expect(await expired.complete(await attempt(expired, orgId), result())).toBe("expired");
    const down = await service(meta({ "/oauth/access_token": { status: 503, body: {} } }));
    expect(await down.complete(await attempt(down, orgId), result())).toBe("unreachable");
    expect((await row(orgId))?.state).toBe("DISCONNECTED");
  });

  it("a state signed for Instagram is never spent on WhatsApp", async () => {
    const wa = await service(meta());
    const state = await attempt(wa, orgId);
    expect(await wa.complete({ ...state, channel: "instagram" }, result())).toBe("expired");
    expect((await row(orgId))?.signupNonce).toBe(state.nonce);
  });

  it("WhatsApp closed: no attempt opens and nothing is exchanged", async () => {
    const t = meta();
    const wa = await service(t);
    const state = await attempt(wa, orgId);
    vi.stubEnv("SOCIAL_CONNECT", "");
    try {
      expect(await wa.start(orgId, userId)).toEqual({ result: "unavailable" });
      expect(await wa.complete(state, result())).toBe("unavailable");
    } finally {
      vi.stubEnv("SOCIAL_CONNECT", "whatsapp");
    }
    expect(t.calls).toHaveLength(0);
  });
});
