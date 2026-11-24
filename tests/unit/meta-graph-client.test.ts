import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { inspect } from "node:util";
import { z } from "zod";
import {
  appSecretProof,
  createGraphClient,
  readUsage,
  type GraphTransport,
} from "@server/channels/providers/meta/graph-client";
import { classifyMetaError, MetaError, MetaShapeError } from "@server/channels/providers/meta/errors";
import { metaAppSecret, metaConfigured, signingSecrets } from "@server/channels/providers/meta/settings";
import { SOCIAL_ERROR } from "@server/channels/social/types";

/** social-selling/meta-foundation unit 1: the Graph client, its errors and the app's settings (D1, D2, D11, D12). */

const SECRET = "app-secret-0123456789";
const TOKEN = "EAAtoken-that-must-never-be-logged";

function respond(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function clientWith(transport: GraphTransport) {
  return createGraphClient({ transport, appSecret: () => SECRET });
}

describe("graph client", () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it("signs with appsecret_proof and keeps the token out of the URL", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const client = clientWith(async (url, init) => {
      seenUrl = url;
      seenAuth = new Headers(init.headers).get("authorization") ?? "";
      return respond(200, { id: "1" });
    });
    await client.call({ host: "facebook", method: "GET", path: "/me", step: "test.me", token: TOKEN }, z.object({ id: z.string() }));
    const url = new URL(seenUrl);
    expect(url.pathname).toBe("/v26.0/me");
    expect(url.searchParams.get("appsecret_proof")).toBe(createHmac("sha256", SECRET).update(TOKEN).digest("hex"));
    expect(seenUrl).not.toContain(TOKEN);
    expect(seenAuth).toBe(`Bearer ${TOKEN}`);
  });

  it("answers the parsed data and the usage pressure", async () => {
    const client = clientWith(async () =>
      respond(200, { id: "7" }, { "x-app-usage": JSON.stringify({ call_count: 80, total_time: 10, total_cputime: 5 }) }),
    );
    const answer = await client.call({ host: "facebook", method: "GET", path: "/x", step: "test.x" }, z.object({ id: z.string() }));
    expect(answer.data.id).toBe("7");
    expect(answer.usage.pressure).toBeCloseTo(0.8);
  });

  it("a send Meta accepted but answered in an unknown shape is uncertain, never failed (ADR-0086)", async () => {
    const client = clientWith(async () => respond(200, { unexpected: "shape" }));
    await expect(
      client.call({ host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", body: {} }, z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: SOCIAL_ERROR.UNCERTAIN });
  });

  it("a body read cut off after a send is uncertain", async () => {
    const client = clientWith(async () => {
      const response = respond(200, {});
      vi.spyOn(response, "text").mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
      return response;
    });
    await expect(
      client.call({ host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", body: {} }, z.unknown()),
    ).rejects.toMatchObject({ code: SOCIAL_ERROR.UNCERTAIN });
  });

  it("refuses a token passed in the query", async () => {
    const client = clientWith(async () => respond(200, {}));
    await expect(
      client.call({ host: "facebook", method: "GET", path: "/x", step: "t", query: { access_token: TOKEN } }, z.unknown()),
    ).rejects.toThrow(/access_token/);
  });

  it("does not sign Instagram Login calls with the Meta app's proof (Q5)", async () => {
    let seenUrl = "";
    const client = clientWith(async (url) => {
      seenUrl = url;
      return respond(200, {});
    });
    await client.call({ host: "instagram", method: "GET", path: "/me", step: "ig.me", token: "IGAAtoken" }, z.unknown());
    expect(new URL(seenUrl).searchParams.has("appsecret_proof")).toBe(false);
  });

  it("refuses a read answered in a shape it does not know", async () => {
    const client = clientWith(async () => respond(200, { unexpected: "shape" }));
    await expect(
      client.call({ host: "facebook", method: "GET", path: "/x", step: "test.shape" }, z.object({ id: z.string() })),
    ).rejects.toBeInstanceOf(MetaShapeError);
  });

  it("a server error on a send is uncertain; on a read it is unavailable (ADR-0086)", async () => {
    const client = clientWith(async () => respond(500, {}));
    const send = client.call({ host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", body: { a: 1 } }, z.unknown());
    await expect(send).rejects.toMatchObject({ code: SOCIAL_ERROR.UNCERTAIN });
    const read = client.call({ host: "facebook", method: "GET", path: "/1", step: "wa.read" }, z.unknown());
    await expect(read).rejects.toMatchObject({ code: SOCIAL_ERROR.UNAVAILABLE });
  });

  it("a timeout on a send is uncertain; a refused connection is unavailable", async () => {
    const timeout = clientWith(async () => {
      throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
    });
    await expect(
      timeout.call({ host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", body: {} }, z.unknown()),
    ).rejects.toMatchObject({ code: SOCIAL_ERROR.UNCERTAIN });
    const refused = clientWith(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    });
    await expect(
      refused.call({ host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", body: {} }, z.unknown()),
    ).rejects.toMatchObject({ code: SOCIAL_ERROR.UNAVAILABLE });
  });

  it("logs one line per call with no token, body or Meta text (meta-foundation R9)", async () => {
    const client = clientWith(async () =>
      respond(400, { error: { code: 100, message: "Secret detail about +919820011100", fbtrace_id: "Ab" } }),
    );
    const failure = await client
      .call(
        { host: "facebook", method: "POST", path: "/1/messages", step: "wa.send", token: TOKEN, body: { text: "hello buyer" }, context: { orgId: "org1", connectionId: "c1", lane: "messages" } },
        z.unknown(),
      )
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MetaError);
    console.error(failure);
    console.log(inspect(failure));
    const everything = logs.join("\n");
    for (const forbidden of [TOKEN, "EAA", "IGAA", "hello buyer", "Secret detail", "+919820011100", "fbtrace"]) {
      expect(everything).not.toContain(forbidden);
    }
    expect(JSON.parse(logs[0])).toMatchObject({ scope: "meta.graph", step: "wa.send", status: 400, code: "refused", metaCode: 100, orgId: "org1", connectionId: "c1", lane: "messages" });
    expect((failure as MetaError).reasonText).toContain("Secret detail");
  });

  it("sends a form body to Meta's OAuth endpoints", async () => {
    let seenBody = "";
    let seenType = "";
    const client = clientWith(async (_url, init) => {
      seenBody = String(init.body);
      seenType = new Headers(init.headers).get("content-type") ?? "";
      return respond(200, { access_token: "x" });
    });
    await client.call(
      { host: "instagramOauth", method: "POST", path: "/oauth/access_token", step: "ig.exchange", body: { code: "c", grant_type: "authorization_code" }, form: true, mayHaveTakenEffect: false },
      z.object({ access_token: z.string() }),
    );
    expect(seenType).toBe("application/x-www-form-urlencoded");
    expect(new URLSearchParams(seenBody).get("code")).toBe("c");
  });
});

describe("Meta errors in our words", () => {
  const cases: [string, number, { code?: number; error_subcode?: number }, string][] = [
    ["an expired token", 400, { code: 190 }, SOCIAL_ERROR.AUTH],
    ["an application rate limit", 400, { code: 4 }, SOCIAL_ERROR.RATE_LIMITED],
    ["WhatsApp throughput", 400, { code: 130429 }, SOCIAL_ERROR.RATE_LIMITED],
    ["WhatsApp's closed window", 400, { code: 131047 }, SOCIAL_ERROR.WINDOW_CLOSED],
    ["Instagram's closed window", 400, { code: 10, error_subcode: 2534022 }, SOCIAL_ERROR.WINDOW_CLOSED],
    ["an undeliverable number", 400, { code: 131026 }, SOCIAL_ERROR.UNDELIVERABLE],
    ["a missing permission", 400, { code: 200 }, SOCIAL_ERROR.PERMISSION],
    ["a temporary failure", 400, { code: 2 }, SOCIAL_ERROR.UNAVAILABLE],
    ["an unknown error on a send", 500, { code: 1 }, SOCIAL_ERROR.UNCERTAIN],
    ["WhatsApp's generic error on a send", 400, { code: 131000 }, SOCIAL_ERROR.UNCERTAIN],
    ["a bad parameter", 400, { code: 100 }, SOCIAL_ERROR.REFUSED],
    ["a 429 with no code", 429, {}, SOCIAL_ERROR.RATE_LIMITED],
  ];
  it.each(cases)("%s", (_name, status, body, expected) => {
    expect(classifyMetaError(status, body, "test", true, null).code).toBe(expected);
  });

  it("keeps Meta's reason only for a refusal, cut to 300 characters", () => {
    const refused = classifyMetaError(400, { code: 100, message: "x".repeat(500) }, "test", true, null);
    expect(refused.reasonText).toHaveLength(300);
    expect(classifyMetaError(400, { code: 190, message: "token text" }, "test", true, null).reasonText).toBeNull();
  });

  it("a rate limit carries when to try again", () => {
    expect(classifyMetaError(400, { code: 4 }, "test", false, 120).retryAfterSeconds).toBe(120);
    expect(classifyMetaError(400, { code: 4 }, "test", false, null).retryAfterSeconds).toBe(60);
  });
});

describe("usage headers", () => {
  it("reads the highest business-use-case figure and its regain time in minutes", () => {
    const headers = new Headers({
      "x-business-use-case-usage": JSON.stringify({
        "123": [{ type: "instagram", call_count: 40, total_cputime: 91, total_time: 20, estimated_time_to_regain_access: 3 }],
      }),
    });
    expect(readUsage(headers)).toEqual({ pressure: 0.91, resetSeconds: 180 });
  });

  it("an unreadable header is no pressure, never a crash", () => {
    expect(readUsage(new Headers({ "x-app-usage": "{not json" }))).toEqual({ pressure: 0, resetSeconds: null });
  });

  it("a bad app header does not hide the business header, and Retry-After counts", () => {
    const headers = new Headers({
      "x-app-usage": "{not json",
      "x-business-use-case-usage": JSON.stringify({ "1": [{ call_count: 50 }] }),
      "retry-after": "90",
    });
    expect(readUsage(headers)).toEqual({ pressure: 0.5, resetSeconds: 90 });
  });
});

describe("Meta app settings (D1, D12, Q5)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("names the missing setting, never its value", () => {
    delete process.env.META_APP_SECRET;
    expect(() => metaAppSecret()).toThrow(/META_APP_SECRET/);
    process.env.META_APP_SECRET = "short";
    expect(() => metaAppSecret()).toThrow(/META_APP_SECRET/);
    expect(() => metaAppSecret()).not.toThrow(/short/);
  });

  it("each product signs with its own secret, the previous one only while rotating", () => {
    process.env.META_APP_SECRET = "current-secret-0123";
    process.env.META_INSTAGRAM_APP_SECRET = "instagram-secret-0123";
    delete process.env.META_APP_SECRET_PREVIOUS;
    delete process.env.META_INSTAGRAM_APP_SECRET_PREVIOUS;
    expect(signingSecrets("whatsapp")).toEqual(["current-secret-0123"]);
    expect(signingSecrets("instagram")).toEqual(["instagram-secret-0123"]);
    process.env.META_APP_SECRET_PREVIOUS = "previous-secret-0123";
    expect(signingSecrets("whatsapp")).toEqual(["current-secret-0123", "previous-secret-0123"]);
  });

  it("is not configured without its product's settings", () => {
    delete process.env.META_INSTAGRAM_APP_ID;
    expect(metaConfigured("instagram")).toBe(false);
  });

  it("appsecret_proof is HMAC-SHA256 of the token", () => {
    expect(appSecretProof("t", "s")).toBe(createHmac("sha256", "s").update("t").digest("hex"));
  });
});
