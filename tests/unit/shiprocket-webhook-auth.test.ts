/**
 * The Shiprocket tracking webhook trusts only a request carrying the dashboard's token
 * (docs/GTM-READINESS.md B5): a forged "delivered" would release a payout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const configuredProvider = vi.fn();
vi.mock("@server/shipping", () => ({ shippingOrchestrator: { handleWebhook: vi.fn() } }));
vi.mock("@server/shipping/shipment-status.service", () => ({ applyProviderStatus: vi.fn() }));
vi.mock("@server/shipping/tracking.service", () => ({ trackingService: { configuredProvider } }));
vi.mock("@server/checkout/order.service", () => ({ orderService: { markDelivered: vi.fn() } }));

const { POST } = await import("@/app/api/webhooks/shipping/shiprocket/route");
const { isShiprocketWebhookAuthentic } = await import("@server/shipping/webhook-auth");

const TOKEN = "a-long-random-token-from-the-dashboard";
const post = (headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/webhooks/shipping/shiprocket", {
      method: "POST",
      body: JSON.stringify({ awb: "123", shipment_status: "DELIVERED" }),
      headers: { "content-type": "application/json", ...headers },
    }),
  );

beforeEach(() => {
  vi.stubEnv("SHIPROCKET_WEBHOOK_TOKEN", TOKEN);
  vi.spyOn(console, "error").mockImplementation(() => {});
  configuredProvider.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/webhooks/shipping/shiprocket", () => {
  it("refuses a request with no token, before reading anything", async () => {
    expect((await post()).status).toBe(401);
    expect(configuredProvider).not.toHaveBeenCalled();
  });

  it("refuses a wrong token", async () => {
    expect((await post({ "x-api-key": "guess" })).status).toBe(401);
  });

  it("refuses everything while no token is configured", async () => {
    vi.stubEnv("SHIPROCKET_WEBHOOK_TOKEN", "");
    expect((await post({ "x-api-key": "" })).status).toBe(401);
    expect(isShiprocketWebhookAuthentic("anything", undefined)).toBe(false);
  });

  it("lets the right token through to processing", async () => {
    await post({ "x-api-key": TOKEN });
    expect(configuredProvider).toHaveBeenCalledTimes(1);
  });
});
