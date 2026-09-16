import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { toErrorResponse } from "@/lib/api-error-response";
import { getRateLimitIdentifier, withRateLimit } from "@/lib/rate-limit";
import { contactMessageSchema } from "@/lib/validation/schemas/contact.schema";
import { contactService } from "@server/support/contact.service";

/**
 * POST /api/contact — send the store a message (docs/specs/contact-us/).
 *
 * Deliberately open to signed-out visitors: someone who cannot sign in is exactly the
 * person who needs to make contact (spec R5). A session, when there is one, is used to
 * *replace* the name and email in the body rather than to permit the request — the
 * service re-reads the account (TRD D3).
 *
 * **Unthrottled in practice.** `withRateLimit` allows everything while the cache is
 * unwired (specs/rate-limiting), so the real control is the service's flood guard.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const limited = await withRateLimit(
      request,
      { interval: 10 * 60 * 1000, uniqueTokenPerInterval: 5 },
      (req) => getRateLimitIdentifier(req, session?.user?.id)
    );
    if (limited) return limited;

    const input = contactMessageSchema.parse(await request.json());
    await contactService.submit(input, session?.user?.id ?? null);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not send your message. Please try again.");
  }
}
