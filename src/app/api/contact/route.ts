import { optionalActiveSession } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/api-error-response";
import { getRateLimitIdentifier, withRateLimit } from "@/lib/rate-limit";
import {
  contactMessageSchema,
  guestContactMessageSchema,
} from "@/lib/validation/schemas/contact.schema";
import { emailService } from "@server/notifications/email.service";

/**
 * POST /api/contact — email a Contact us message to the store (docs/specs/contact-us/).
 *
 * Open to guests. A signed-in sender's reply address is the session's, never the body's;
 * the signed session is the only thing here the sender cannot write.
 *
 * **Unthrottled.** `withRateLimit` allows everything while the cache is detached, and
 * nothing else guards this route — a known gap, accepted until rate limiting returns.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await optionalActiveSession({ onBlocked: "guest" });
    const accountEmail = session?.user?.email ?? null;

    const limited = await withRateLimit(
      request,
      { interval: 10 * 60 * 1000, uniqueTokenPerInterval: 5 },
      (req) => getRateLimitIdentifier(req, session?.user?.id),
    );
    if (limited) return limited;

    const body = await request.json();
    const { subject, message } = contactMessageSchema.parse(body);
    const replyEmail =
      accountEmail ?? guestContactMessageSchema.parse(body).email;

    await emailService.sendContactMessage({
      subject,
      message,
      replyEmail,
      senderName: accountEmail ? (session?.user?.name ?? null) : null,
      signedIn: accountEmail !== null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(
      error,
      "Could not send your message. Please try again, or reach us on WhatsApp.",
    );
  }
}
