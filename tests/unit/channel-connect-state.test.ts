// The OAuth `state` a connect attempt carries (channel-connectors R2, TRD D4): a forged, edited or
// stale return connects nothing, and a stale one still says which shop to send the person back to.
import { describe, expect, it } from "vitest";
import { CONNECT_PURPOSE, signConnectState, verifyConnectState } from "@server/channels/connect-state";

const input = { orgId: "org_1", userId: "user_1", channel: "amazon" as const, purpose: CONNECT_PURPOSE.CONNECT };
const T0 = Date.UTC(2026, 9, 20, 10, 0, 0);

describe("connect state", () => {
  it("verifies what it signed, carrying shop, member, channel and purpose", () => {
    const check = verifyConnectState(signConnectState(input, T0), T0 + 60_000);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.state).toMatchObject(input);
  });

  it("refuses an edited body: another shop cannot be swapped in (spec A2)", () => {
    const [body, sig] = signConnectState(input, T0).split(".");
    const edited = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    edited.orgId = "org_2";
    const forged = `${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${sig}`;
    expect(verifyConnectState(forged, T0)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a missing or malformed state", () => {
    expect(verifyConnectState(null, T0)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyConnectState("not-a-token", T0)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyConnectState("a.b.c", T0)).toEqual({ ok: false, reason: "invalid" });
  });

  it("calls a return older than ten minutes expired, and still knows the shop (spec A2)", () => {
    const check = verifyConnectState(signConnectState(input, T0), T0 + 10 * 60_000 + 1);
    expect(check.ok).toBe(false);
    if (!check.ok && check.reason === "expired") expect(check.state.orgId).toBe("org_1");
    else throw new Error("expected an expired state");
  });

  it("cannot be signed with a different secret's key", () => {
    const token = signConnectState(input, T0);
    const saved = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "another-secret";
    try {
      expect(verifyConnectState(token, T0)).toEqual({ ok: false, reason: "invalid" });
    } finally {
      process.env.NEXTAUTH_SECRET = saved;
    }
  });

  it("is unique per attempt", () => {
    expect(signConnectState(input, T0)).not.toBe(signConnectState(input, T0));
  });
});
