/**
 * A suspended account cannot keep acting, and a session issued under a password that has since
 * changed or been cleared is over (docs/GTM-READINESS.md B5). Every route reads the session through
 * `requireSession` or `optionalActiveSession`, which check both on one read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { credentialFingerprint } from "@/lib/credential-fingerprint";

const getServerSession = vi.fn();
const findAdminStanding = vi.fn();
const addItem = vi.fn();
const clearCart = vi.fn();
const sendContactMessage = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/identity/account.service", () => ({ accountService: { findAdminStanding } }));
vi.mock("@server/wishlist/wishlist.service", () => ({ wishlistService: { addItem } }));
vi.mock("@server/cart/cart.service", () => ({ cartService: { clearCart } }));
vi.mock("@server/notifications/email.service", () => ({ emailService: { sendContactMessage } }));

const { POST: saveToWishlist } = await import("@/app/api/wishlist/route");
const { DELETE: clearCartRoute } = await import("@/app/api/cart/route");
const { POST: contact } = await import("@/app/api/contact/route");
const { optionalActiveSession, requireSession } = await import("@/lib/admin-auth");

const HASH = "$2a$10$current";
const json = (url: string, body: unknown, method = "POST") =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  getServerSession.mockReset().mockResolvedValue({
    credential: credentialFingerprint(HASH),
    user: { id: "u1", email: "u1@example.com", name: "U" },
  });
  findAdminStanding.mockReset().mockResolvedValue({ isBlocked: false, passwordHash: HASH, platformRole: "USER" });
  addItem.mockReset().mockResolvedValue(undefined);
  clearCart.mockReset().mockResolvedValue(undefined);
  sendContactMessage.mockReset().mockResolvedValue(undefined);
});

describe("a suspended account", () => {
  beforeEach(() => findAdminStanding.mockResolvedValue({ isBlocked: true, passwordHash: HASH, platformRole: "USER" }));

  it("is refused with 403 and nothing is written", async () => {
    expect((await saveToWishlist(json("/api/wishlist", { productId: "p1" }))).status).toBe(403);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("gets the standard 403, not a 500, where the handler had its own catch", async () => {
    expect((await clearCartRoute(json("/api/cart", undefined, "DELETE"))).status).toBe(403);
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("can still write to support, with the session's address and the form's real shape", async () => {
    const response = await contact(json("/api/contact", { subject: "My account", message: "Why was it suspended?" }));
    expect(response.status).toBe(200);
    expect(sendContactMessage).toHaveBeenCalledWith(expect.objectContaining({ replyEmail: "u1@example.com" }));
  });

  it("reads as a guest, or is kept, only where the route says so", async () => {
    await expect(optionalActiveSession()).rejects.toThrow(/suspended/);
    await expect(optionalActiveSession({ onBlocked: "guest" })).resolves.toBeNull();
    await expect(optionalActiveSession({ onBlocked: "allow" })).resolves.toMatchObject({ user: { id: "u1" } });
  });
});

describe("a session issued under an old password", () => {
  beforeEach(() => findAdminStanding.mockResolvedValue({ isBlocked: false, passwordHash: null, platformRole: "USER" }));

  it("is over: required routes answer 401, optional ones read a guest", async () => {
    await expect(requireSession()).rejects.toThrow(/sign in again/i);
    await expect(optionalActiveSession({ onBlocked: "allow" })).resolves.toBeNull();
    expect((await saveToWishlist(json("/api/wishlist", { productId: "p1" }))).status).toBe(401);
  });

  it("including one minted before sessions carried a fingerprint", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    findAdminStanding.mockResolvedValue({ isBlocked: false, passwordHash: HASH, platformRole: "USER" });
    await expect(requireSession()).rejects.toThrow(/sign in again/i);
  });

  it("and one whose account no longer exists", async () => {
    findAdminStanding.mockResolvedValue(null);
    await expect(optionalActiveSession()).resolves.toBeNull();
  });
});

describe("an active account", () => {
  it("goes through", async () => {
    await saveToWishlist(json("/api/wishlist", { productId: "p1" }));
    expect(addItem).toHaveBeenCalledWith("u1", "p1");
  });
});

describe("nothing reads the session around the check", () => {
  const ROOT = resolve(__dirname, "../..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  // The root layout reads it for the chrome alone (name, avatar); it shows no one's data.
  const READS_ONLY_CHROME = new Set(["src/app/layout.tsx"]);
  const files = [...walk(join(ROOT, "src/app")), ...walk(join(ROOT, "src/data-access-layer"))];

  it("finds the files at all", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("no route, page or data read calls getServerSession", () => {
    const direct = files
      .map((f) => relative(ROOT, f))
      .filter((f) => !READS_ONLY_CHROME.has(f))
      .filter((f) => /\bgetServerSession\s*\(/.test(readFileSync(join(ROOT, f), "utf8")));
    expect(direct, "use requireSession or optionalActiveSession (src/lib/admin-auth.ts)").toEqual([]);
  });
});
