/**
 * The marketplaces' redirect, end to end through the route (channel-connectors R2, A2, D4): only the
 * member who started a connect, still a member, on the channel the state was signed for, can
 * finish it. Everything else lands on Channels with an outcome and connects nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ resolveOrgScope: vi.fn() }));
const complete = vi.hoisted(() => vi.fn(async () => "connected"));

vi.mock("@/lib/org-auth", () => auth);
vi.mock("@server/channels/channel-connection.service", async () => {
  const { verifyConnectState } = await vi.importActual<typeof import("@server/channels/connect-state")>(
    "@server/channels/connect-state",
  );
  return {
    channelConnectionService: {
      readReturn: (_channel: string, params: URLSearchParams) => {
        const consent = { state: params.get("state"), code: params.get("code"), declined: !params.get("code"), externalAccountId: null };
        return { consent, check: verifyConnectState(consent.state) };
      },
      completeConnect: complete,
    },
  };
});

import { GET } from "@/app/api/channels/[channel]/callback/route";
import { CONNECT_PURPOSE, signConnectState } from "@server/channels/connect-state";

const signed = (over: Partial<{ userId: string; channel: "amazon" | "flipkart" }> = {}, at = Date.now()) =>
  signConnectState({ orgId: "org_1", userId: "user_1", channel: "amazon", purpose: CONNECT_PURPOSE.CONNECT, ...over }, at);

async function callback(channel: string, state: string | null) {
  const url = new URL(`https://bhendi-bazaar.com/api/channels/${channel}/callback`);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("code", "CODE");
  const response = await GET(new NextRequest(url), { params: Promise.resolve({ channel }) });
  return new URL(response.headers.get("location")!);
}

beforeEach(() => {
  auth.resolveOrgScope.mockReset();
  complete.mockClear();
});

describe("the consent callback", () => {
  it("finishes a connect for the member who started it, and says so", async () => {
    auth.resolveOrgScope.mockResolvedValue({ orgId: "org_1", userId: "user_1", role: "OWNER" });
    const back = await callback("amazon", signed());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(back.pathname).toBe("/org/org_1/channels");
    expect(back.searchParams.get("result")).toBe("connected");
  });

  it("connects nothing for a forged state, and sends the person home (spec A2)", async () => {
    const back = await callback("amazon", "forged.state");
    expect(complete).not.toHaveBeenCalled();
    expect(back.pathname).toBe("/");
  });

  it("calls a state older than ten minutes expired, back on the right shop (spec A2)", async () => {
    const back = await callback("amazon", signed({}, Date.now() - 11 * 60_000));
    expect(complete).not.toHaveBeenCalled();
    expect(back.searchParams.get("result")).toBe("expired");
    expect(back.pathname).toBe("/org/org_1/channels");
  });

  it("refuses a return finished in another sign-in (spec R2)", async () => {
    auth.resolveOrgScope.mockResolvedValue({ orgId: "org_1", userId: "someone_else", role: "STAFF" });
    const back = await callback("amazon", signed());
    expect(complete).not.toHaveBeenCalled();
    expect(back.searchParams.get("result")).toBe("other_session");
  });

  it("refuses a person who is signed out or no longer a member", async () => {
    auth.resolveOrgScope.mockRejectedValue(new Error("not a member"));
    const back = await callback("amazon", signed());
    expect(complete).not.toHaveBeenCalled();
    expect(back.searchParams.get("result")).toBe("other_session");
  });

  it("never spends an Amazon state on Flipkart's callback (D4)", async () => {
    auth.resolveOrgScope.mockResolvedValue({ orgId: "org_1", userId: "user_1", role: "OWNER" });
    const back = await callback("flipkart", signed({ channel: "amazon" }));
    expect(complete).not.toHaveBeenCalled();
    expect(back.searchParams.get("result")).toBe("expired");
  });
});
