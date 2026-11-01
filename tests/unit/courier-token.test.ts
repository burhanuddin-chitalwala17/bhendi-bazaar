/**
 * A courier update is trusted only with our shared token, checked before its body is read
 * ([order-fulfilment](../../docs/specs/own-store/order-fulfilment/trd.md) D9, D10; spec A4, Q32).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const receive = vi.fn();
vi.mock("@server/checkout/courier-update", () => ({ receiveCourierUpdate: (...a: unknown[]) => receive(...a) }));

import { isCourierTokenValid } from "@server/shipping/courier-token";
import { POST } from "@/app/api/webhooks/shipping/tracking/route";
import { shiprocketWebhookSchema } from "@/lib/validation/schemas/webhook.schema";

const TOKEN = "s3cret-token";
const call = (body: string, token?: string) =>
  POST(
    new NextRequest("http://localhost/api/webhooks/shipping/tracking", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token === undefined ? {} : { "x-api-key": token }) },
      body,
    }),
  );

describe("A4: the courier token", () => {
  it("accepts only the exact secret, and refuses everything when no secret is set", () => {
    expect(isCourierTokenValid(TOKEN, TOKEN)).toBe(true);
    expect(isCourierTokenValid(null, TOKEN)).toBe(false);
    expect(isCourierTokenValid("", TOKEN)).toBe(false);
    expect(isCourierTokenValid("s3cret-toke", TOKEN)).toBe(false);
    expect(isCourierTokenValid(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(isCourierTokenValid("", "")).toBe(false);
    expect(isCourierTokenValid("anything", undefined)).toBe(false);
  });
});

describe("A4, Q32: the tracking webhook", () => {
  beforeEach(() => {
    receive.mockReset();
    vi.stubEnv("SHIPPING_WEBHOOK_TOKEN", TOKEN);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a missing or wrong token with 401 before reading the body", async () => {
    // Not JSON at all: a 401 rather than a 400 proves the body was never parsed.
    expect((await call("{not json")).status).toBe(401);
    expect((await call("{not json", "wrong")).status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
  });

  it("refuses everything while the secret is unset", async () => {
    vi.stubEnv("SHIPPING_WEBHOOK_TOKEN", "");
    expect((await call(JSON.stringify({ awb: "A1", shipment_status: "DELIVERED" }), "")).status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
  });

  it("with the token, hands the parsed update on and answers 200, a recorded conflict included", async () => {
    receive.mockResolvedValueOnce({ kind: "conflict" });
    const res = await call(JSON.stringify({ awb: 123456, shipment_status: "DELIVERED", etd: "2026-11-06 15:40:19" }), TOKEN);
    expect(res.status).toBe(200);
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "shiprocket", awb: "123456", wording: "DELIVERED", etd: "2026-11-06" }),
    );
  });

  it("answers 500 when applying the update throws, so the courier retries", async () => {
    receive.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await call(JSON.stringify({ awb: "A1", shipment_status: "DELIVERED" }), TOKEN)).status).toBe(500);
  });
});

describe("D10: the courier's ETD", () => {
  const etd = (v: unknown) => shiprocketWebhookSchema.parse({ awb: "A1", shipment_status: "IN TRANSIT", etd: v }).etd;
  it("reads Shiprocket's India timestamp as its calendar day, and anything else as no estimate", () => {
    expect(etd("2026-11-06 15:40:19")).toBe("2026-11-06");
    expect(etd("2026-11-06")).toBe("2026-11-06");
    expect(etd("2026-02-30 10:00:00")).toBeNull();
    expect(etd("06 11 2026")).toBeNull();
    expect(etd(undefined)).toBeNull();
    expect(etd(null)).toBeNull();
  });
});
