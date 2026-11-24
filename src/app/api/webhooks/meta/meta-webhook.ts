import { NextRequest, NextResponse } from "next/server";
import { META_MAX_BODY_BYTES, metaIntakeService } from "@server/channels/meta-intake.service";
import type { SocialPlatform } from "@server/channels/social/types";
import { DomainError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";
import { ERROR_RESPONSE_COPY } from "@/lib/lib-copy";

/**
 * One Meta product's webhook route (meta-foundation R2, D3). Unlike Razorpay's, a signed but
 * unroutable delivery answers 200: Meta disables webhooks that keep failing (ADR-0078 decision 2).
 * Refusals carry no body: Meta reads only the status.
 */

/** A fault is logged by its kind only: a Prisma error can print its arguments, and those hold sender ids. */
function unavailable(error: unknown): NextResponse {
  const code = (error as { code?: unknown } | null)?.code;
  console.error(JSON.stringify({ scope: "meta.webhook", error: (error as Error | null)?.name ?? "unknown", code: typeof code === "string" ? code : null }));
  return toErrorResponse(new DomainError(ERROR_RESPONSE_COPY.somethingWentWrong, { status: 503 }));
}

export function metaWebhook(product: SocialPlatform) {
  async function GET(req: NextRequest) {
    try {
      const params = req.nextUrl.searchParams;
      const challenge = metaIntakeService.verifySubscription(
        params.get("hub.mode"),
        params.get("hub.verify_token"),
        params.get("hub.challenge"),
      );
      if (challenge === null) return new NextResponse(null, { status: 403 });
      return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    } catch (error) {
      return unavailable(error);
    }
  }

  async function POST(req: NextRequest) {
    try {
      const declared = Number(req.headers.get("content-length") ?? "0");
      if (declared > META_MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
      const body = new Uint8Array(await req.arrayBuffer());
      const outcome = await metaIntakeService.receive(product, body, req.headers.get("x-hub-signature-256"));
      if (outcome.kind === "refused") {
        return new NextResponse(null, { status: outcome.reason === "signature" ? 401 : 413 });
      }
      return NextResponse.json({ received: true });
    } catch (error) {
      // Not stored: answer 5xx so Meta delivers it again (meta-foundation R3).
      return unavailable(error);
    }
  }

  return { GET, POST };
}
