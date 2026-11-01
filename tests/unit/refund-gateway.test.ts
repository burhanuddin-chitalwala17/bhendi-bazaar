/**
 * order-fulfilment U6, D17 and A9 at the gateway boundary: what Razorpay's answers to a refund
 * become. The failure each guards: a timeout read as "nothing was refunded" (so a retry refunds
 * twice), a refusal losing its reason, and a retry adopting a refund that moved no money.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let repo: typeof import("@server/payments/providers/razorpay/razorpay.repository").razorpayRepository;

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  vi.resetModules();
  ({ razorpayRepository: repo } = await import("@server/payments/providers/razorpay/razorpay.repository"));
});

afterEach(() => vi.unstubAllGlobals());

const answer = (status: number, body: unknown) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe("createRefund (D17)", () => {
  it("A9: asks once for exactly the amount, keyed by our refund row as the receipt", async () => {
    const fetch = answer(200, { id: "rfnd_1", status: "pending" });
    vi.stubGlobal("fetch", fetch);
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 124_000, receipt: "ref_1" })).toEqual({
      kind: "started",
      gatewayRefundId: "rfnd_1",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    expect(JSON.parse(String(init?.body))).toMatchObject({ amount: 124_000, receipt: "ref_1" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("A9: a timeout or a dropped connection is unknown, never a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation timed out.", "TimeoutError"); }));
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 1, receipt: "r" })).toEqual({ kind: "unknown" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 1, receipt: "r" })).toEqual({ kind: "unknown" });
  });

  it("a gateway fault (5xx) is unknown: the money may have moved", async () => {
    vi.stubGlobal("fetch", answer(502, { error: { description: "Bad gateway" } }));
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 1, receipt: "r" })).toEqual({ kind: "unknown" });
  });

  it("a refusal (4xx) carries Razorpay's own reason for the admin", async () => {
    vi.stubGlobal("fetch", answer(400, { error: { description: "The payment has been fully refunded already" } }));
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 1, receipt: "r" })).toEqual({
      kind: "refused",
      reason: "The payment has been fully refunded already",
    });
  });

  it("a replayed receipt answered 200 with a failed refund is refused, never started: no money moved", async () => {
    vi.stubGlobal("fetch", answer(200, { id: "rfnd_failed", receipt: "ref_1", status: "failed" }));
    expect(await repo.createRefund({ paymentId: "pay_1", amount: 1, receipt: "ref_1" })).toEqual({
      kind: "refused",
      reason: "This refund is marked failed",
    });
  });
});

describe("findRefundByReceipt (D17 retry)", () => {
  it("adopts the payment's refund carrying our receipt, and not a failed one", async () => {
    vi.stubGlobal("fetch", answer(200, { items: [
      { id: "rfnd_failed", receipt: "ref_1", status: "failed" },
      { id: "rfnd_other", receipt: "ref_2", status: "processed" },
      { id: "rfnd_ok", receipt: "ref_1", status: "pending" },
    ] }));
    expect(await repo.findRefundByReceipt("pay_1", "ref_1")).toEqual({ kind: "started", gatewayRefundId: "rfnd_ok" });
    vi.stubGlobal("fetch", answer(200, { items: [{ id: "rfnd_failed", receipt: "ref_1", status: "failed" }] }));
    expect(await repo.findRefundByReceipt("pay_1", "ref_1")).toBeNull();
  });

  it("throws when Razorpay cannot be asked, since 'none found' would invite a second refund", async () => {
    vi.stubGlobal("fetch", answer(500, {}));
    await expect(repo.findRefundByReceipt("pay_1", "ref_1")).rejects.toThrow(/500/);
  });
});
