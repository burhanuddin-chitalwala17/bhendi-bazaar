/**
 * Rate limits as a caller meets them, through the real handlers and the in-process limiter
 * that local development and tests run on (rate-limiting D1a, D6, D11).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = { value: null as { user: { id: string } } | null };
const lookup = vi.fn();
const quote = vi.fn();

vi.mock("next-auth", () => ({ getServerSession: async () => session.value }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@server/identity/account.service", () => ({ accountService: {} }));
vi.mock("@server/notifications/email.service", () => ({ emailService: {} }));
vi.mock("@server/checkout/order.service", () => ({ orderService: { lookupOrderByCode: lookup } }));
vi.mock("@server/catalog/product.read.repository", () => ({
  productsRepository: {
    listForPricing: async () => [{ id: "p1", orgId: "o1", categoryId: "c1", price: 10_000 }],
  },
}));
vi.mock("@server/promotions/promotion.service", () => ({ promotionService: { quote } }));

import { resetLimiters } from "@/lib/rate-limit/limiter";
import { RATE_LIMIT_ENV } from "@/lib/rate-limit/config";

const signup = await import("@/app/api/auth/signup/route");
const orderLookup = await import("@/app/api/orders/lookup/route");
const promotionsQuote = await import("@/app/api/checkout/promotions/quote/route");

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  }) as never;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetLimiters();
  session.value = null;
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv(RATE_LIMIT_ENV.CLIENT_IP_HEADER, "x-vercel-forwarded-for");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  lookup.mockResolvedValue(null);
  quote.mockResolvedValue({
    lines: [],
    attributions: [],
    couponCoveredKeys: [],
    totalDiscountPaise: 0,
    rejection: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

describe("signup", () => {
  it("refuses a hammering address with a friendly retry time in the envelope (spec A1)", async () => {
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 6; i++) {
      last = await signup.POST(post("/api/auth/signup", {}, { "x-vercel-forwarded-for": "1.1.1.1" }));
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(last!.status).toBe(429);
    expect(await last!.json()).toEqual({
      error: expect.stringMatching(/^Too many attempts\. Please try again in 15 minutes\.$/),
    });
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("with no keys locally, warns once that limits are per-process and still refuses the eleventh (spec A2)", async () => {
    for (const name of [RATE_LIMIT_ENV.STORE_URL, RATE_LIMIT_ENV.LEGACY_STORE_URL, RATE_LIMIT_ENV.CLIENT_IP_HEADER]) {
      vi.stubEnv(name, "");
    }
    let eleventh: Response | null = null;
    for (let i = 0; i < 11; i++) eleventh = await signup.POST(post("/api/auth/signup", {}));
    expect(eleventh!.status).toBe(429);
    const perProcess = warn.mock.calls.filter(([message]: unknown[]) => String(message).includes("per-process"));
    expect(perProcess).toHaveLength(1);
  });
});

describe("guest order lookup", () => {
  it("does not reset the budget when x-forwarded-for is rotated (spec A5)", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) {
      last = await orderLookup.POST(
        post("/api/orders/lookup", { code: "BB-ABCDEFGH" }, {
          "x-vercel-forwarded-for": "1.1.1.1",
          "x-forwarded-for": `10.0.0.${i}`,
        }),
      );
    }
    expect(last!.status).toBe(429);
    expect(lookup).toHaveBeenCalledTimes(10);
  });
});

describe("checkout coupon quote", () => {
  const withCode = { items: [{ productId: "p1", quantity: 1 }], code: "GUESS-01" };
  const without = { items: [{ productId: "p1", quantity: 1 }] };
  const from = { "x-vercel-forwarded-for": "2.2.2.2" };

  it("gives the 21st code quote from one address the friendly refusal (spec A7)", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await promotionsQuote.POST(post("/api/checkout/promotions/quote", withCode, from))).status).toBe(200);
    }
    const refused = await promotionsQuote.POST(post("/api/checkout/promotions/quote", withCode, from));
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toMatch(/^Too many attempts\. Please try again in \d+ minutes?\.$/);
    expect(quote).toHaveBeenCalledTimes(20);
  });

  it("does not count a quote without a code (spec A7)", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await promotionsQuote.POST(post("/api/checkout/promotions/quote", without, from))).status).toBe(200);
    }
    expect((await promotionsQuote.POST(post("/api/checkout/promotions/quote", withCode, from))).status).toBe(200);
  });
});
