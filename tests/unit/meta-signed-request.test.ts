import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSignedRequest } from "@server/channels/providers/meta/signed-request";

/** meta-foundation unit 4: Meta's signed request, the way it authenticates its account callbacks (D6, D7, D12). */

const SECRET = "unit-signed-request-secret";
const OLD = "unit-signed-request-old-secret";

function signed(payload: object, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest().toString("base64url");
  return `${sig}.${body}`;
}

describe("readSignedRequest", () => {
  it("reads Meta's user id from a request signed with our secret", () => {
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA256", user_id: "17841400000000001", issued_at: 1764000000 }), [SECRET])).toEqual({
      userId: "17841400000000001",
      issuedAt: new Date(1764000000 * 1000),
      secretIndex: 0,
    });
  });

  it("refuses a numeric id, which past 2^53 has already lost digits", () => {
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA256", user_id: 17841400000000001 }), [SECRET])).toBeNull();
  });

  it("is accepted under the previous secret while one is rotated, and says which matched", () => {
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA256", user_id: "u" }, OLD), [SECRET, OLD])?.secretIndex).toBe(1);
  });

  it("refuses another secret, a changed payload, another algorithm and anything malformed", () => {
    const good = signed({ algorithm: "HMAC-SHA256", user_id: "u" });
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA256", user_id: "u" }, "someone-else-secret"), [SECRET])).toBeNull();
    const [sig] = good.split(".");
    expect(readSignedRequest(`${sig}.${Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "v" })).toString("base64url")}`, [SECRET])).toBeNull();
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA1", user_id: "u" }), [SECRET])).toBeNull();
    expect(readSignedRequest(signed({ algorithm: "HMAC-SHA256" }), [SECRET])).toBeNull();
    for (const bad of ["", ".", "abc", `${good}.x`, `.${good.split(".")[1]}`, "a.!!!"]) expect(readSignedRequest(bad, [SECRET])).toBeNull();
  });
});

describe("isSocialOpen (R10, A5)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("opens a platform only when listed and its Meta settings are present", async () => {
    const { isSocialOpen } = await import("@server/channels/channel-availability");
    vi.stubEnv("SOCIAL_CONNECT", "instagram");
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "verify-token-long-enough");
    vi.stubEnv("META_INSTAGRAM_APP_ID", "123456789");
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", "instagram-secret-long-enough");
    vi.stubEnv("META_APP_ID", "");
    expect(isSocialOpen("instagram")).toBe(true);
    expect(isSocialOpen("whatsapp")).toBe(false);
    vi.stubEnv("META_INSTAGRAM_APP_SECRET", "");
    expect(isSocialOpen("instagram")).toBe(false);
  });
});
