/**
 * POST /api/webhooks/shipping/tracking — Shiprocket's tracking updates (order-fulfilment D9, D10).
 * Not under a "shiprocket" path: its dashboard refuses a webhook URL naming it (INTEGRATIONS.md).
 */
import { NextRequest, NextResponse } from "next/server";

import { COURIER_TOKEN_HEADER, isCourierTokenValid } from "@server/shipping/courier-token";
import { receiveCourierUpdate } from "@server/checkout/courier-update";
import { courierPayloadSchema, shiprocketWebhookSchema } from "@/lib/validation/schemas/webhook.schema";

const PROVIDER = "shiprocket";

export async function POST(request: NextRequest) {
  // Before the body is read: a stranger's JSON never reaches the parser (A4).
  if (!isCourierTokenValid(request.headers.get(COURIER_TOKEN_HEADER))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body is not JSON" }, { status: 400 });
  }
  const parsed = shiprocketWebhookSchema.safeParse(body);
  const payload = courierPayloadSchema.safeParse(body);
  if (!parsed.success || !payload.success) {
    return NextResponse.json({ success: false, error: "Not a tracking update" }, { status: 400 });
  }

  try {
    const result = await receiveCourierUpdate({
      provider: PROVIDER,
      awb: parsed.data.awb,
      wording: parsed.data.shipment_status,
      etd: parsed.data.etd,
      payload: payload.data,
    });
    // A conflict is recorded, which is the loud part; retrying would only add a second row (Q32).
    return NextResponse.json({ success: true, result: result.kind });
  } catch (error) {
    console.error("[shipping] courier update failed:", error);
    // 500 so Shiprocket retries; every move and notice is idempotent, so the retry is safe (Q32).
    return NextResponse.json({ success: false, error: "Update not applied" }, { status: 500 });
  }
}
