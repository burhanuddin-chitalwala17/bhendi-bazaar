import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { orderService } from "@server/checkout/order.service";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await req.text();

    // Verify webhook using service
    const verification = await paymentService.verifyWebhook(signature, rawBody);

    if (!verification.isValid) {
      console.error("Webhook verification failed:", verification.error);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const { event } = verification;
    if (!event) {
      return NextResponse.json({ error: "No event data" }, { status: 400 });
    }

    console.log(`Webhook received: ${event.eventType}`, event.provider);

    // Handle different event types
    switch (event.eventType) {
      case "payment.captured":
      case "payment.success":
        await handlePaymentSuccess(event);
        break;

      case "payment.failed":
        await handlePaymentFailed(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }

    return NextResponse.json({ received: true, event: event.eventType });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(event: any) {
  // Extract order ID from payload and update order status
  const payload = event.payload as any;
  const localOrderId = payload?.payment?.entity?.notes?.localOrderId;

  if (localOrderId) {
    await orderService.updateOrder(localOrderId, {
      paymentStatus: "paid",
      paymentId: payload?.payment?.entity?.id,
    });
    console.log(`Order ${localOrderId} marked as paid`);
  }
}

async function handlePaymentFailed(event: any) {
  const payload = event.payload as any;
  const localOrderId = payload?.payment?.entity?.notes?.localOrderId;

  if (localOrderId) {
    await orderService.updateOrder(localOrderId, {
      paymentStatus: "failed",
    });
    console.log(`Order ${localOrderId} marked as failed`);
  }
}