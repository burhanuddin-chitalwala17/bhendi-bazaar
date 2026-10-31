/**
 * A suspended account cannot keep acting through a route that read the session directly
 * (docs/GTM-READINESS.md B5). Every route handler reads it through `requireSession` or
 * `optionalActiveSession`, which check the account's standing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const getServerSession = vi.fn();
const findAdminStanding = vi.fn();
const addItem = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/identity/account.service", () => ({ accountService: { findAdminStanding } }));
vi.mock("@server/wishlist/wishlist.service", () => ({ wishlistService: { addItem } }));

const { POST } = await import("@/app/api/wishlist/route");
const { optionalActiveSession } = await import("@/lib/admin-auth");

const save = () =>
  POST(
    new NextRequest("http://localhost/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId: "p1" }),
      headers: { "content-type": "application/json" },
    }),
  );

beforeEach(() => {
  getServerSession.mockReset().mockResolvedValue({ user: { id: "u1" } });
  findAdminStanding.mockReset().mockResolvedValue({ isBlocked: false });
  addItem.mockReset().mockResolvedValue(undefined);
});

describe("a suspended account", () => {
  it("is refused with 403 and nothing is written", async () => {
    findAdminStanding.mockResolvedValue({ isBlocked: true });
    const response = await save();
    expect(response.status).toBe(403);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("an active account goes through", async () => {
    await save();
    expect(addItem).toHaveBeenCalledWith("u1", "p1");
  });

  it("reads as a guest where a suspended person must still reach the route", async () => {
    findAdminStanding.mockResolvedValue({ isBlocked: true });
    await expect(optionalActiveSession({ onBlocked: "guest" })).resolves.toBeNull();
    await expect(optionalActiveSession()).rejects.toThrow(/suspended/);
  });
});

describe("route handlers never read the session around the standing check", () => {
  const API = resolve(__dirname, "../../src/app/api");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
    });
  const routes = walk(API).filter((f) => f.endsWith("route.ts"));

  it("finds the handlers at all", () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it("none calls getServerSession", () => {
    const direct = routes
      .filter((f) => /\bgetServerSession\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(API, f));
    expect(direct, "use requireSession or optionalActiveSession (src/lib/admin-auth.ts)").toEqual([]);
  });
});
