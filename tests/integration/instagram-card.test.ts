/**
 * The Instagram card's facts against a real database (connect-instagram unit 3): the account line
 * stored at connect (A1, R7), the checklist computed from message-access facts (R6, R12, D3, D4),
 * the first message ticking Turn on replies through channels' sink, Meta's refusal showing until a
 * newer message, and the card carrying no credential (A7).
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const IG_ID = `1786${RUN}`;
const TOKEN = `IGAAcard-token-${RUN}`;

type Answer = { status: number; body: unknown };
function transport(me: { user_id: string; username: string; account_type: string }) {
  const answers: Record<string, Answer> = {
    "/oauth/access_token": { status: 200, body: { access_token: "IGAAshort-token-value", user_id: me.user_id } },
    "/access_token": { status: 200, body: { access_token: TOKEN, token_type: "bearer", expires_in: 5_184_000 } },
    "/me?": { status: 200, body: me },
    "/me/subscribed_apps": { status: 200, body: { success: true } },
  };
  return async (url: string) => {
    const key = Object.keys(answers).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected call ${url}`);
    return new Response(JSON.stringify(answers[key].body), { status: answers[key].status, headers: { "content-type": "application/json" } });
  };
}
const business = (username = "niqab.boutique", id = IG_ID) => ({ user_id: id, username, account_type: "BUSINESS" });

describe.skipIf(!isDisposableDb)("Instagram card (local db)", () => {
  let orgId = "";
  let userId = "";

  beforeAll(async () => {
    ({ orgId, userId } = await ensureFixtures());
    vi.stubEnv("SOCIAL_CONNECT", "instagram");
    vi.stubEnv("META_INSTAGRAM_APP_ID", "1000000001");
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", "instagram-card-secret-long");
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "instagram-card-verify-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("HOME_BRAND_ORG_ID", orgId);
  });

  afterEach(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "instagram" } });
  });

  afterAll(() => vi.unstubAllEnvs());

  async function graph(me: ReturnType<typeof business>) {
    const { instagramLogin } = await import("@server/channels/providers/meta/instagram-login");
    const { createGraphClient } = await import("@server/channels/providers/meta/graph-client");
    const { instagramAppSecret } = await import("@server/channels/providers/meta/settings");
    return instagramLogin(createGraphClient({ transport: transport(me), appSecret: instagramAppSecret }));
  }

  async function connect(me = business()) {
    const { instagramConnectService } = await import("@server/channels/instagram-connect.service");
    const { signConnectState, verifyConnectState } = await import("@server/channels/connect-state");
    const check = verifyConnectState(signConnectState({ orgId, userId, channel: "instagram", purpose: "connect" }));
    if (!check.ok) throw new Error("state did not verify");
    expect(await instagramConnectService(await graph(me)).complete(check.state, { code: "CODE", declined: false })).toBe("connected");
    const { prisma } = await import("@server/shared/prisma");
    return (await prisma.channelConnection.findUniqueOrThrow({ where: { orgId_channel: { orgId, channel: "instagram" } } })).id;
  }

  const card = async () => {
    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    return (await channelConnectionService.overview(orgId)).instagram;
  };
  const steps = async () => (await card())?.checklist?.map((s) => `${s.step}:${s.state}`);

  /** A message in, handed to channels' sink as the drain would. */
  async function messageIn(connectionId: string, occurredAt: Date) {
    await import("@server/channels/channels.sinks");
    const { sinksFor } = await import("@server/shared/social-events/sinks");
    const sink = sinksFor("inbound-message").find((s) => s.name === "channels.message-access");
    if (!sink) throw new Error("channels.message-access is not registered");
    await sink.handle([
      {
        kind: "inbound-message",
        key: `msg-${occurredAt.getTime()}`,
        connectionId,
        platform: "instagram",
        occurredAt,
        personKey: "igsid-1",
        personScopedId: null,
        personName: null,
        personHandle: null,
        personPhone: null,
        messageId: `mid-${occurredAt.getTime()}`,
        messageKind: "text",
        text: "Is this in stock?",
        attachments: [],
        replyTo: null,
        buttonPayload: null,
        storyRef: null,
        productRetailerId: null,
        referral: null,
        unsupportedLabel: null,
        coordinates: null,
      },
    ]);
  }

  it("R11: with Instagram open and nothing connected, the card is there, not connected, with no checklist", async () => {
    expect(await card()).toMatchObject({ state: "not_connected", username: null, checklist: null, messagesOff: false });
  });

  it("R11: with Instagram not open and nothing connected, there is no card (it stays under Coming soon)", async () => {
    vi.stubEnv("SOCIAL_CONNECT", "");
    try {
      expect(await card()).toBeNull();
    } finally {
      vi.stubEnv("SOCIAL_CONNECT", "instagram");
    }
  });

  it("A1: after connecting, the card shows @username · Business, who connected, and Turn on replies as the next step", async () => {
    await connect();
    expect(await card()).toMatchObject({
      state: "connected",
      username: "niqab.boutique",
      accountKind: "business",
      connectedBy: expect.any(String),
      messagesOff: false,
    });
    expect(await steps()).toEqual(["connect:done", "replies:next", "first_post:todo", "comment_dm:todo"]);
  });

  it("A7: the card carries no token and no Instagram account id", async () => {
    await connect();
    const text = JSON.stringify(await card());
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(IG_ID);
  });

  it("D3: Done on the sheet makes the step wait for the first message; with nothing connected it is not found", async () => {
    const { instagramConnection } = await import("@server/channels/instagram-connection.service");
    await expect(instagramConnection.repliesAsked(orgId)).rejects.toMatchObject({ name: "NotFoundError" });
    await connect();
    await instagramConnection.repliesAsked(orgId);
    expect(await steps()).toEqual(["connect:done", "replies:waiting", "first_post:next", "comment_dm:todo"]);
  });

  it("D3, Q16: the first message ticks Turn on replies, and a replayed older one changes nothing", async () => {
    const id = await connect();
    const first = new Date();
    await messageIn(id, first);
    expect(await steps()).toEqual(["connect:done", "replies:done", "first_post:next", "comment_dm:todo"]);
    await messageIn(id, new Date(first.getTime() - 60_000));
    const { prisma } = await import("@server/shared/prisma");
    expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).firstMessageAt).toEqual(first);
  });

  it("D3: Meta refusing messages turns the card to Needs you until a newer message arrives; an older one does not clear it", async () => {
    const id = await connect();
    await messageIn(id, new Date(Date.now() - 120_000));
    const { instagramConnection } = await import("@server/channels/instagram-connection.service");
    const refusedAt = new Date();
    await instagramConnection.messagesRefused(id, refusedAt);
    expect(await card()).toMatchObject({ messagesOff: true });
    expect(await steps()).toEqual(["connect:done", "replies:next", "first_post:todo", "comment_dm:todo"]);
    await messageIn(id, new Date(refusedAt.getTime() - 1_000));
    expect(await card()).toMatchObject({ messagesOff: true });
    await messageIn(id, new Date(refusedAt.getTime() + 1_000));
    expect(await card()).toMatchObject({ messagesOff: false });
  });

  it("D3: a refusal on a disconnected connection writes nothing", async () => {
    const id = await connect();
    const { instagramConnectionService } = await import("@server/channels/instagram-connection.service");
    await instagramConnectionService(await graph(business())).disconnect(orgId, userId);
    await instagramConnectionService(await graph(business())).messagesRefused(id);
    const { prisma } = await import("@server/shared/prisma");
    expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id } })).messagesOffAt).toBeNull();
  });

  it("Q4, Q19: the same account again, even after a disconnect, keeps its message access; another account starts over", async () => {
    const id = await connect();
    await messageIn(id, new Date());
    await connect();
    expect(await steps()).toEqual(["connect:done", "replies:done", "first_post:next", "comment_dm:todo"]);

    const { instagramConnectionService } = await import("@server/channels/instagram-connection.service");
    await instagramConnectionService(await graph(business())).disconnect(orgId, userId);
    await connect();
    expect(await steps()).toEqual(["connect:done", "replies:done", "first_post:next", "comment_dm:todo"]);

    await instagramConnectionService(await graph(business())).disconnect(orgId, userId);
    await connect(business("zarahijab", `${IG_ID}9`));
    expect(await card()).toMatchObject({ username: "zarahijab" });
    expect(await steps()).toEqual(["connect:done", "replies:next", "first_post:todo", "comment_dm:todo"]);
  });

  it("R7: Check now refreshes the account line when the handle changed on Instagram", async () => {
    await connect();
    const { instagramConnectionService } = await import("@server/channels/instagram-connection.service");
    expect(await instagramConnectionService(await graph({ ...business("niqab.studio"), account_type: "MEDIA_CREATOR" })).check(orgId, new Date(Date.now() + 120_000))).toBe("ok");
    expect(await card()).toMatchObject({ username: "niqab.studio", accountKind: "creator" });
  });
});
