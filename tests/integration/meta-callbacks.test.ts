/**
 * Meta's account callbacks against a real database (meta-foundation unit 4): removing our app inside
 * Instagram or WhatsApp turns the card to Needs reconnecting (R6, A3); a deletion request is stored
 * naming nobody, every registered domain forgets the person, and the status page reads it (R7, A4).
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const IG_SECRET = "integration-instagram-callback-secret";
const WA_SECRET = "integration-whatsapp-callback-secret";
const RUN = Date.now();
const ACCOUNT = `CB-IG-${RUN}`;

function signed(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest().toString("base64url")}.${body}`;
}

describe.skipIf(!isDisposableDb)("Meta account callbacks (local db)", () => {
  const ids: string[] = [];
  let orgId = "";

  beforeAll(async () => {
    process.env.META_INSTAGRAM_APP_SECRET = IG_SECRET;
    process.env.META_APP_SECRET = WA_SECRET;
    process.env.META_INSTAGRAM_APP_ID = "1000000001";
    process.env.META_APP_ID = "1000000002";
    process.env.META_SIGNUP_CONFIG_ID = "1000000003";
    process.env.META_WEBHOOK_VERIFY_TOKEN = "integration-verify-token-long";
    process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
    ({ orgId } = await ensureFixtures());
  });

  async function connection(channel: string, data: Record<string, string | Date>) {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId, channel } });
    const { id } = await prisma.channelConnection.create({
      data: { orgId, channel, state: "CONNECTED", refreshToken: "sealed-placeholder", ...data },
      select: { id: true },
    });
    ids.push(id);
    return id;
  }

  const stateOf = async (id: string) => {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.channelConnection.findUniqueOrThrow({ where: { id }, select: { state: true, lastErrorCode: true } });
  };

  const logged: string[] = [];
  beforeEach(() => {
    for (const level of ["info", "log", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
    }
  });

  afterEach(async () => {
    const { resetForgetters } = await import("@server/shared/social-events/forget");
    resetForgetters();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { id: { in: ids } } });
    await prisma.dataDeletionRequest.deleteMany({ where: { requestedAt: { gte: new Date(RUN - 60_000) } } });
    // A6: no line written during these callbacks names a person, an account or a secret.
    for (const line of logged) for (const secret of [ACCOUNT, `PERSON-${RUN}`, `P2-${RUN}`, IG_SECRET, WA_SECRET]) expect(line).not.toContain(secret);
  });

  it("A3: Instagram's deauthorize turns that shop's card to Needs reconnecting, and only that one", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    const mine = await connection("instagram", { externalAccountId: ACCOUNT });
    await metaCallbacksService.deauthorize(signed({ algorithm: "HMAC-SHA256", user_id: ACCOUNT }, IG_SECRET));
    expect(await stateOf(mine)).toEqual({ state: "NEEDS_RECONNECT", lastErrorCode: "removed_in_app" });
  });

  it("A3: a deauthorize Meta signed before the shop reconnected changes nothing", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    const mine = await connection("instagram", { externalAccountId: ACCOUNT, connectedAt: new Date() });
    const before = Math.floor(Date.now() / 1000) - 3600;
    await metaCallbacksService.deauthorize(signed({ algorithm: "HMAC-SHA256", user_id: ACCOUNT, issued_at: before }, IG_SECRET));
    expect((await stateOf(mine)).state).toBe("CONNECTED");
  });

  it("A3: a deauthorize signed with any other secret changes nothing", async () => {
    const { metaCallbacksService, SignedRequestRefused } = await import("@server/channels/meta-callbacks.service");
    const mine = await connection("instagram", { externalAccountId: ACCOUNT });
    await expect(metaCallbacksService.deauthorize(signed({ algorithm: "HMAC-SHA256", user_id: ACCOUNT }, WA_SECRET))).rejects.toBeInstanceOf(SignedRequestRefused);
    expect((await stateOf(mine)).state).toBe("CONNECTED");
  });

  it("WhatsApp removing our app or offboarding the number turns the card to Needs reconnecting", async () => {
    // A fresh module graph, so the sink file registers into an empty registry.
    vi.resetModules();
    await import("@server/channels/channels.sinks");
    const { sinksFor: freshSinks } = await import("@server/shared/social-events/sinks");
    const removed = await connection("whatsapp", { externalPhoneId: `CB-PH-${RUN}`, connectedAt: new Date(Date.now() - 60_000) });
    const fact = (event: string, occurredAt = new Date()) => ({ kind: "account-update", key: `k-${event}`, connectionId: removed, platform: "whatsapp", occurredAt, event, detail: null });
    const [sink] = freshSinks("account-update");
    await sink.handle([fact("quality-changed")] as never);
    // A notice from before the shop's latest connect, handed on late, leaves the connection alone.
    await sink.handle([fact("removed", new Date(Date.now() - 3_600_000))] as never);
    expect((await stateOf(removed)).state).toBe("CONNECTED");
    expect((await stateOf(removed)).state).toBe("CONNECTED");
    await sink.handle([fact("offboarded")] as never);
    expect(await stateOf(removed)).toEqual({ state: "NEEDS_RECONNECT", lastErrorCode: "offboarded" });
  });

  it("A4: a deletion request answers with a code and a link, stores no plain id, and every domain forgets the person", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    const { registerForgetter } = await import("@server/shared/social-events/forget");
    const { prisma } = await import("@server/shared/prisma");
    const forgotten: string[] = [];
    registerForgetter({ name: "test.inbox", forget: async (platform, id) => void forgotten.push(`${platform}:${id}`) });

    const person = `PERSON-${RUN}`;
    const answer = await metaCallbacksService.requestDeletion(signed({ algorithm: "HMAC-SHA256", user_id: person }, WA_SECRET));
    expect(answer.confirmation_code).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
    expect(answer.url).toMatch(new RegExp(`/data-deletion/${answer.confirmation_code}$`));

    const row = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { code: answer.confirmation_code } });
    expect(JSON.stringify(row)).not.toContain(person);
    expect(row.product).toBe("whatsapp");
    expect(await metaCallbacksService.status(answer.confirmation_code)).toMatchObject({ done: false });

    await metaCallbacksService.runDeletion(row.id);
    expect(forgotten).toEqual([`whatsapp:${person}`]);
    expect((await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id: row.id } })).sealedUserId).toBe("");
    // Done only once the raw events the person may appear in have aged out too (Q7).
    expect(await metaCallbacksService.status(answer.confirmation_code)).toMatchObject({ done: false });
    expect(await metaCallbacksService.status(answer.confirmation_code, new Date(Date.now() + 31 * 86_400_000))).toMatchObject({ done: true });
    await metaCallbacksService.runDeletion(row.id);
    expect(forgotten).toHaveLength(1);
  });

  it("A4: a forgetter that fails leaves the request pending, for the queue to retry", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    const { registerForgetter } = await import("@server/shared/social-events/forget");
    registerForgetter({ name: "test.down", forget: async () => { throw new Error("down"); } });
    const answer = await metaCallbacksService.requestDeletion(signed({ algorithm: "HMAC-SHA256", user_id: `P2-${RUN}` }, IG_SECRET));
    const { prisma } = await import("@server/shared/prisma");
    const row = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { code: answer.confirmation_code } });
    expect(row.product).toBe("instagram");
    await expect(metaCallbacksService.runDeletion(row.id)).rejects.toThrow("down");
    expect(await metaCallbacksService.status(answer.confirmation_code)).toMatchObject({ done: false });
  });

  it("A4: with only WhatsApp configured, a deletion request still works", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", "");
    try {
      const answer = await metaCallbacksService.requestDeletion(signed({ algorithm: "HMAC-SHA256", user_id: `P3-${RUN}` }, WA_SECRET));
      expect(answer.confirmation_code).toHaveLength(12);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("the status page knows nothing of an unknown or malformed reference", async () => {
    const { metaCallbacksService } = await import("@server/channels/meta-callbacks.service");
    expect(await metaCallbacksService.status("ZZZZZZZZZZZZ")).toBeNull();
    expect(await metaCallbacksService.status("x'; drop")).toBeNull();
  });
});
