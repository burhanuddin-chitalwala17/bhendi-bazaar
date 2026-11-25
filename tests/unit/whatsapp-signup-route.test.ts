/**
 * The WhatsApp sign-up through its route (connect-whatsapp R4, A3): only the member who opened the
 * attempt, still a member, can spend it. Everything else answers an outcome and connects nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ resolveOrgScope: vi.fn() }));
const complete = vi.hoisted(() => vi.fn(async () => "connected"));
const limiter = vi.hoisted(() => ({ limitRequest: vi.fn(async () => null as Response | null) }));

vi.mock("@/lib/org-auth", () => auth);
vi.mock("@/lib/rate-limit", () => limiter);
vi.mock("@server/channels/whatsapp-connect.service", async () => {
  const { verifyConnectState } = await vi.importActual<typeof import("@server/channels/connect-state")>("@server/channels/connect-state");
  return { whatsappConnect: { readState: verifyConnectState, complete } };
});

import { POST } from "@/app/api/channels/whatsapp/signup/route";
import { CONNECT_PURPOSE, signConnectState } from "@server/channels/connect-state";

const state = (userId = "user_1") => signConnectState({ orgId: "org_1", userId, channel: "whatsapp", purpose: CONNECT_PURPOSE.CONNECT });
const body = (over: Record<string, unknown> = {}) => ({ state: state(), code: "CODE", businessId: "1001", phoneId: "2001", kind: "coexistence", ...over });

async function post(payload: unknown) {
  const response = await POST(
    new NextRequest("https://bhendi-bazaar.com/api/channels/whatsapp/signup", { method: "POST", body: JSON.stringify(payload) }),
  );
  return { status: response.status, json: (await response.json()) as { result?: string } };
}

beforeEach(() => {
  auth.resolveOrgScope.mockReset();
  complete.mockClear();
  limiter.limitRequest.mockClear();
});

describe("the WhatsApp sign-up route", () => {
  it("spends the attempt for the member who opened it, counted against the rate limit", async () => {
    auth.resolveOrgScope.mockResolvedValue({ orgId: "org_1", userId: "user_1", role: "OWNER" });
    expect((await post(body())).json.result).toBe("connected");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(limiter.limitRequest).toHaveBeenCalledWith(expect.anything(), "POST /api/channels/whatsapp/signup", { userId: "user_1" });
  });

  it("A3: another signed-in person connects nothing", async () => {
    auth.resolveOrgScope.mockResolvedValue({ orgId: "org_1", userId: "user_2", role: "OWNER" });
    expect((await post(body())).json.result).toBe("other_session");
    expect(complete).not.toHaveBeenCalled();
  });

  it("A3: someone no longer a member connects nothing", async () => {
    auth.resolveOrgScope.mockRejectedValue(new Error("not a member"));
    expect((await post(body())).json.result).toBe("other_session");
    expect(complete).not.toHaveBeenCalled();
  });

  it("A3: a forged state connects nothing and asks nobody", async () => {
    expect((await post(body({ state: "forged.state" }))).json.result).toBe("expired");
    expect(auth.resolveOrgScope).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a sign-up, in the envelope", async () => {
    const { status } = await post(body({ phoneId: "../../me" }));
    expect(status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});
