/**
 * Razorpay webhook — the reliable confirmation trigger (the browser return is the
 * fast one; together they satisfy payment-confirmation R3).
 *
 * An unmatched payload returns non-2xx ON PURPOSE (trd.md D5): the gateway then
 * retries and records the failure on its dashboard. Returning 200 to a payload we
 * did nothing with is how this handler silently no-op'd for months — creation wrote
 * `notes.orderId` while this file read `notes.localOrderId`, and nothing noticed.
 */
import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { isDomainError } from "@server/shared/domain-error";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await req.text();

    const verification = await paymentService.verifyWebhook(signature, rawBody);
    if (!verification.isValid || !verification.event) {
      console.error("Webhook verification failed:", verification.error);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const { event } = verification;
    const entity = (event.payload as { payment?: { entity?: Record<string, unknown> } })
      ?.payment?.entity;

    switch (event.eventType) {
      case "payment.captured":
      case "payment.success": {
        const result = await paymentService.confirmFromWebhookEvent(entity ?? {});
        return NextResponse.json({ received: true, ...result });
      }

      case "payment.failed": {
        await paymentService.markFailedFromWebhookEvent(entity ?? {});
        return NextResponse.json({ received: true });
      }

      default:
        // Genuinely irrelevant event types are acknowledged — retrying them would
        // change nothing. Only payloads we SHOULD have handled fail loudly.
        return NextResponse.json({ received: true, ignored: event.eventType });
    }
  } catch (error) {
    console.error("Webhook processing failed:", error);
    const status = isDomainError(error) ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status }
    );
  }
}
