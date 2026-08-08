// Authorization is the one place a passing happy path proves nothing, so most of this
// file is attempts to reach something. See portal-separation trd.md D4, D6, D10.
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { UnauthorizedError } from "@server/shared/domain-error";
import type { OrgScope } from "@/lib/org-auth";

const requireSession = vi.fn();
const findMembership = vi.fn();

vi.mock("@/lib/admin-auth", () => ({ requireSession: () => requireSession() }));
vi.mock("@server/catalog/org.member.repository", () => ({
  orgMemberRepository: { findMembership: (u: string, o: string) => findMembership(u, o) },
}));

const { withOrg } = await import("@/lib/org-auth");

const signedInAs = (id: string, platformRole: "USER" | "ADMIN" = "USER") =>
  requireSession.mockResolvedValue({ user: { id, platformRole } });

const request = {} as NextRequest;
const call = (handler: Parameters<typeof withOrg>[0], orgId = "org-a") =>
  withOrg(handler)(request, { params: Promise.resolve({ orgId }) });

beforeEach(() => {
  requireSession.mockReset();
  findMembership.mockReset();
});

describe("withOrg", () => {
  it("hands the handler a scope when the person is a member", async () => {
    signedInAs("user-1");
    findMembership.mockResolvedValue({ id: "m1", orgId: "org-a", role: "OWNER" });
    const handler = vi.fn(async (_r: NextRequest, _s: OrgScope, _p: { orgId: string }) => new Response("ok"));

    const response = await call(handler);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][1]).toEqual({
      orgId: "org-a",
      role: "OWNER",
      userId: "user-1",
    });
  });

  it("refuses a member of another org, and never runs the handler", async () => {
    signedInAs("user-1");
    findMembership.mockResolvedValue(null); // member of org-b, not org-a
    const handler = vi.fn(async (_r: NextRequest, _s: OrgScope, _p: { orgId: string }) => new Response("ok"));

    const response = await call(handler, "org-a");

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a platform admin who is not a member — there is no bypass (D6)", async () => {
    signedInAs("admin-1", "ADMIN");
    findMembership.mockResolvedValue(null);
    const handler = vi.fn(async (_r: NextRequest, _s: OrgScope, _p: { orgId: string }) => new Response("ok"));

    const response = await call(handler);

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports the refusal in the standard error envelope", async () => {
    signedInAs("user-1");
    findMembership.mockResolvedValue(null);

    const response = await call(async () => new Response("ok"));
    const body = await response.json();

    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("checks the membership against the org in the path", async () => {
    signedInAs("user-1");
    findMembership.mockResolvedValue({ id: "m1", orgId: "org-b", role: "STAFF" });

    await call(async () => new Response("ok"), "org-b");

    expect(findMembership).toHaveBeenCalledWith("user-1", "org-b");
  });

  it("takes the scope's orgId from the membership, not from the path", async () => {
    // If these ever disagree, the row the database confirmed is the one to trust.
    signedInAs("user-1");
    findMembership.mockResolvedValue({ id: "m1", orgId: "org-from-db", role: "STAFF" });
    const handler = vi.fn(async (_r: NextRequest, _s: OrgScope, _p: { orgId: string }) => new Response("ok"));

    await call(handler, "org-from-path");

    expect(handler.mock.calls[0][1].orgId).toBe("org-from-db");
  });

  it("reports a signed-out request as 401, distinct from a 403", async () => {
    // A real UnauthorizedError, not a look-alike: `toErrorResponse` branches on
    // `instanceof DomainError`, so a hand-made object would fall through to the generic
    // 500 and this test would pass while the 401 path was broken.
    requireSession.mockRejectedValue(new UnauthorizedError());
    const handler = vi.fn(async (_r: NextRequest, _s: OrgScope, _p: { orgId: string }) => new Response("ok"));

    const response = await call(handler);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
