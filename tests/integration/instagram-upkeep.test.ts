/**
 * Keeping an Instagram connection alive and ending it, against a real database with Instagram's
 * answers stubbed at the transport (connect-instagram unit 2): renewal from the daily pass, once
 * under concurrency (A5); removal inside Instagram reaching the Home line (A6); disconnect leaving
 * no readable credential (A7); the daily check and Check now.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const IG_ID = `1785${RUN}`;
const OLD_TOKEN = `IGAAold-token-${RUN}`;
const NEW_TOKEN = `IGAAnew-token-${RUN}`;
const IG_SECRET = "instagram-upkeep-secret-long";
const DAY = 86_400_000;

type Answer = { status: number; body: unknown };
/** Answers only calls made with our row's token, so another suite's rows never reach these counts. */
function transport(answers: Record<string, Answer | (() => Promise<Answer> | Answer)>) {
  const calls: Array<{ url: string; method: string; token: string | null }> = [];
  const fn = async (url: string, init: RequestInit) => {
    const auth = new Headers(init.headers).get("authorization");
    const token = auth?.replace(/^Bearer /, "") ?? null;
    if (token !== OLD_TOKEN && token !== NEW_TOKEN) return new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 });
    calls.push({ url, method: init.method ?? "GET", token });
    const key = Object.keys(answers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected call ${url}`);
    const a = answers[key];
    const answer = typeof a === "function" ? await a() : a;
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
  };
  return { fn, calls, count: (path: string) => calls.filter((c) => c.url.includes(path)).length };
}

const healthy = (overrides: Record<string, Answer | (() => Promise<Answer> | Answer)> = {}) =>
  transport({
    "/refresh_access_token": { status: 200, body: { access_token: NEW_TOKEN, token_type: "bearer", expires_in: 5_184_000 } },
    "/me?": { status: 200, body: { user_id: IG_ID, username: "zarahijab", account_type: "BUSINESS" } },
    "/me/subscribed_apps": { status: 200, body: { success: true } },
    ...overrides,
  });

const revoked: Answer = { status: 400, body: { error: { code: 190, message: `Error validating access token ${OLD_TOKEN}` } } };

describe.skipIf(!isDisposableDb)("Instagram upkeep (local db)", () => {
  let orgId = "";
  let userId = "";
  let otherOrgId = "";
  let id = "";
  const logged: string[] = [];

  beforeAll(async () => {
    ({ orgId, userId, otherOrgId } = await ensureFixtures());
    vi.stubEnv("SOCIAL_CONNECT", "instagram");
    vi.stubEnv("META_INSTAGRAM_APP_ID", "1000000001");
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", IG_SECRET);
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "instagram-upkeep-verify-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("HOME_BRAND_ORG_ID", orgId);
  });

  beforeEach(async () => {
    for (const level of ["info", "log", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
    }
    id = await connected({ ageDays: 8 });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "instagram" } });
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    // A7: no line written here carries a token, sealed or plain.
    for (const line of logged) for (const secret of [OLD_TOKEN, NEW_TOKEN]) expect(line).not.toContain(secret);
  });

  /** A connected row whose 60-day token was issued `ageDays` ago. */
  async function connected({ ageDays, lastCheckedAt = null }: { ageDays: number; lastCheckedAt?: Date | null }) {
    const { prisma } = await import("@server/shared/prisma");
    const { encryptSecret } = await import("@server/shared/crypto");
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "instagram" } });
    const row = await prisma.channelConnection.create({
      data: {
        orgId,
        channel: "instagram",
        state: "CONNECTED",
        externalAccountId: IG_ID,
        accessToken: encryptSecret(OLD_TOKEN),
        accessTokenExpiresAt: new Date(Date.now() + (60 - ageDays) * DAY),
        connectedById: userId,
        connectedAt: new Date(Date.now() - ageDays * DAY),
        authorizedAt: new Date(Date.now() - ageDays * DAY),
        lastCheckedAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  async function service(t: ReturnType<typeof transport>) {
    const { instagramConnectionService } = await import("@server/channels/instagram-connection.service");
    const { instagramLogin } = await import("@server/channels/providers/meta/instagram-login");
    const { createGraphClient } = await import("@server/channels/providers/meta/graph-client");
    const { instagramAppSecret } = await import("@server/channels/providers/meta/settings");
    return instagramConnectionService(instagramLogin(createGraphClient({ transport: t.fn, appSecret: instagramAppSecret })));
  }

  const row = async () => {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.channelConnection.findUniqueOrThrow({ where: { id } });
  };
  const tokenOf = async () => {
    const { decryptSecret } = await import("@server/shared/crypto");
    const r = await row();
    return r.accessToken ? decryptSecret(r.accessToken) : null;
  };
  const secretsRow = async () => {
    const { channelConnectionRepository } = await import("@server/channels/channel-connection.repository");
    const r = await channelConnectionRepository.secretsFor(orgId, "instagram");
    if (!r) throw new Error("no row");
    return r;
  };
  const notSuspended = async () => false;

  it("A5: the daily pass renews a token older than 7 days and leaves the connection Connected and checked", async () => {
    const t = healthy();
    const summary = await (await service(t)).maintain(notSuspended);
    expect(t.count("/refresh_access_token")).toBe(1);
    expect(await tokenOf()).toBe(NEW_TOKEN);
    const r = await row();
    expect(r.state).toBe("CONNECTED");
    expect(r.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * DAY);
    expect(r.lastCheckedAt).not.toBeNull();
    expect(summary.renewed).toBeGreaterThanOrEqual(1);
  });

  it("A5: two passes at once renew once, and both leave the one new token", async () => {
    // The refresh answers slowly, so the second pass is waiting on the row lock while it runs.
    const t = healthy({
      "/refresh_access_token": async () => {
        await new Promise((r) => setTimeout(r, 300));
        return { status: 200, body: { access_token: NEW_TOKEN, token_type: "bearer", expires_in: 5_184_000 } };
      },
    });
    const ig = await service(t);
    const stale = await secretsRow();
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await Promise.all([ig.maintainOne(stale, true, summary), ig.maintainOne(stale, true, summary)]);
    expect(t.count("/refresh_access_token")).toBe(1);
    expect(summary.renewed).toBe(1);
    expect(await tokenOf()).toBe(NEW_TOKEN);
    expect((await row()).state).toBe("CONNECTED");
  });

  it("A5: a token renewed within 7 days is not renewed again", async () => {
    id = await connected({ ageDays: 1 });
    const t = healthy();
    await (await service(t)).maintain(notSuspended);
    expect(t.count("/refresh_access_token")).toBe(0);
    expect(await tokenOf()).toBe(OLD_TOKEN);
  });

  it("R8: Instagram refusing the renewal turns the connection to Needs reconnecting, saying why", async () => {
    const t = healthy({ "/refresh_access_token": revoked });
    await (await service(t)).maintain(notSuspended);
    const r = await row();
    expect(r.state).toBe("NEEDS_RECONNECT");
    expect(r.lastErrorCode).toBe("revoked");
    expect(await tokenOf()).toBe(OLD_TOKEN);
  });

  it("R8: Instagram not answering the renewal keeps the connection, to try again tomorrow", async () => {
    const t = healthy({ "/refresh_access_token": { status: 500, body: { error: { code: 2 } } } });
    await (await service(t)).maintain(notSuspended);
    expect((await row()).state).toBe("CONNECTED");
    expect(await tokenOf()).toBe(OLD_TOKEN);
  });

  it("Q8: with no deauthorize call, the daily check finds the app removed and turns the connection to Needs reconnecting", async () => {
    id = await connected({ ageDays: 1 });
    const t = healthy({ "/me?": revoked });
    await (await service(t)).maintain(notSuspended);
    expect(await row()).toMatchObject({ state: "NEEDS_RECONNECT", lastErrorCode: "revoked" });
  });

  it("a suspended shop's connection is left alone", async () => {
    const t = healthy();
    await (await service(t)).maintain(async (org) => org === orgId);
    expect(t.calls).toHaveLength(0);
    expect(await tokenOf()).toBe(OLD_TOKEN);
  });

  it("A6: removing the app inside Instagram shows Needs reconnecting in the shop's attention and on Home", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    const body = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: IG_ID })).toString("base64url");
    const sig = createHmac("sha256", IG_SECRET).update(body).digest().toString("base64url");
    await metaCallbacksService.deauthorize(`${sig}.${body}`);
    expect(await row()).toMatchObject({ state: "NEEDS_RECONNECT", lastErrorCode: "removed_in_app" });

    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    const { attention } = await channelConnectionService.overview(orgId);
    expect(attention).toContainEqual(expect.objectContaining({ channel: "instagram", label: "Instagram", state: "needs_reconnect" }));
    // A shop that holds Social selling but not Channels still sees the line (feature-access Q31).
    const { homeDAL } = await import("@/data-access-layer/org/home.dal");
    const home = await homeDAL.forOrg(orgId, new Date(), { channels: false });
    expect(home.attention.channel).toEqual({ ok: true, value: expect.objectContaining({ channel: "instagram", state: "needs_reconnect" }) });
  });

  it("A7: disconnect stops webhooks, deletes the token and keeps the record Disconnected", async () => {
    const t = healthy();
    await (await service(t)).disconnect(orgId, userId);
    expect(t.calls).toEqual([expect.objectContaining({ method: "DELETE", url: expect.stringContaining("/me/subscribed_apps") })]);
    const r = await row();
    expect(r).toMatchObject({ state: "DISCONNECTED", accessToken: null, accessTokenExpiresAt: null, refreshToken: null, disconnectedById: userId });
    expect(r.externalAccountId).toBe(IG_ID);
    const { prisma } = await import("@server/shared/prisma");
    const audit = await prisma.adminLog.findFirst({ where: { resourceId: id, action: "channel.disconnect" } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(OLD_TOKEN);
  });

  it("A7: disconnect still deletes the token when Instagram refuses the unsubscribe", async () => {
    const t = healthy({ "/me/subscribed_apps": revoked });
    await (await service(t)).disconnect(orgId, userId);
    expect(await row()).toMatchObject({ state: "DISCONNECTED", accessToken: null });
  });

  it("A7: a renewal that read the row before a disconnect never writes a token back", async () => {
    const stale = await secretsRow();
    const t = healthy();
    const ig = await service(t);
    await ig.disconnect(orgId, userId);
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await ig.maintainOne(stale, true, summary);
    expect(t.count("/refresh_access_token")).toBe(0);
    expect(await row()).toMatchObject({ state: "DISCONNECTED", accessToken: null });
  });

  it("A7: a disconnect during a renewal leaves no token, whichever commits first", async () => {
    const t = healthy({
      "/refresh_access_token": async () => {
        await new Promise((r) => setTimeout(r, 300));
        return { status: 200, body: { access_token: NEW_TOKEN, token_type: "bearer", expires_in: 5_184_000 } };
      },
    });
    const ig = await service(t);
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    const renewing = ig.maintainOne(await secretsRow(), true, summary);
    await new Promise((r) => setTimeout(r, 100));
    await ig.disconnect(orgId, userId);
    await renewing;
    expect(await row()).toMatchObject({ state: "DISCONNECTED", accessToken: null });
  });

  it("R8: a renewal that read the row before Instagram's removal landed renews nothing", async () => {
    const stale = await secretsRow();
    const { channelConnectionRepository } = await import("@server/channels/channel-connection.repository");
    await channelConnectionRepository.markRemoved(id, "removed_in_app", new Date());
    const t = healthy();
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await (await service(t)).maintainOne(stale, true, summary);
    expect(t.calls).toHaveLength(0);
    expect(await row()).toMatchObject({ state: "NEEDS_RECONNECT", lastErrorCode: "removed_in_app" });
  });

  it("A6: a connected Instagram raises no line", async () => {
    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    expect((await channelConnectionService.overview(orgId)).attention).not.toContainEqual(expect.objectContaining({ channel: "instagram" }));
    expect(await channelConnectionService.socialAttention(orgId)).toBeNull();
  });

  it("A6: a shop without Social selling gets no Instagram line: it could not reconnect", async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.orgFeature.deleteMany({ where: { orgId: otherOrgId, feature: "social_selling" } });
    await prisma.channelConnection.create({ data: { orgId: otherOrgId, channel: "instagram", state: "NEEDS_RECONNECT", externalAccountId: `other-${IG_ID}`, accessToken: "sealed-placeholder" } });
    try {
      const { channelConnectionService } = await import("@server/channels/channel-connection.service");
      expect(await channelConnectionService.socialAttention(otherOrgId)).toBeNull();
    } finally {
      await prisma.channelConnection.deleteMany({ where: { orgId: otherOrgId, channel: "instagram" } });
    }
  });

  it("D1: the daily check asks Instagram for webhooks again", async () => {
    id = await connected({ ageDays: 1 });
    const t = healthy();
    await (await service(t)).maintain(notSuspended);
    expect(t.calls.filter((c) => c.method === "POST" && c.url.includes("/me/subscribed_apps"))).toHaveLength(1);
  });

  it("R10: a disconnect landing during the daily re-subscription leaves webhooks off", async () => {
    id = await connected({ ageDays: 1 });
    let ig: Awaited<ReturnType<typeof service>> | null = null;
    let disconnected = false;
    const t = healthy({
      "/me/subscribed_apps": async () => {
        // The member disconnects while Meta is answering the pass's subscribe (once: the disconnect's own unsubscribe comes here too).
        if (ig && !disconnected) {
          disconnected = true;
          await ig.disconnect(orgId, userId);
        }
        return { status: 200, body: { success: true } };
      },
    });
    ig = await service(t);
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await ig.maintainOne(await secretsRow(), true, summary);
    const subs = t.calls.filter((c) => c.url.includes("/me/subscribed_apps")).map((c) => c.method);
    // The disconnect's own unsubscribe, then the pass taking back the subscribe it made meanwhile.
    expect(subs).toEqual(["POST", "DELETE", "DELETE"]);
  });

  it("renewal stays free: a shop without Social selling is renewed, never checked", async () => {
    const t = healthy();
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await (await service(t)).maintainOne(await secretsRow(), false, summary);
    expect(summary).toMatchObject({ renewed: 1, checked: 0, locked: 1 });
    expect(t.count("/me?")).toBe(0);
    expect(await tokenOf()).toBe(NEW_TOKEN);
  });

  it("a token sealed under an older key is re-sealed under the current one, unchanged", async () => {
    id = await connected({ ageDays: 1 });
    vi.stubEnv("CREDENTIAL_KEYS", `1:${"0".repeat(64)},2:${"1".repeat(64)}`);
    try {
      const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
      await (await service(healthy())).maintainOne(await secretsRow(), true, summary);
      expect(summary.resealed).toBe(1);
      expect((await row()).accessToken).toMatch(/^v2:/);
      expect(await tokenOf()).toBe(OLD_TOKEN);
    } finally {
      vi.stubEnv("CREDENTIAL_KEYS", `1:${"0".repeat(64)}`);
    }
  });

  it("disconnecting a shop with no Instagram connection is refused", async () => {
    const ig = await service(healthy());
    await ig.disconnect(orgId, userId);
    const { NotFoundError } = await import("@server/shared/domain-error");
    await expect(ig.disconnect(orgId, userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("D4: Check now reads the account and records it; again within a minute it asks Instagram nothing", async () => {
    id = await connected({ ageDays: 1 });
    const t = healthy();
    const ig = await service(t);
    expect(await ig.check(orgId)).toBe("ok");
    expect(t.count("/me?")).toBe(1);
    expect((await row()).lastCheckedAt).not.toBeNull();
    expect(await ig.check(orgId)).toBe("ok");
    expect(t.count("/me?")).toBe(1);
  });

  it("D4: Check now on a removed app answers needs_reconnect", async () => {
    id = await connected({ ageDays: 1 });
    const ig = await service(healthy({ "/me?": revoked }));
    expect(await ig.check(orgId)).toBe("needs_reconnect");
    expect((await row()).state).toBe("NEEDS_RECONNECT");
  });
});
