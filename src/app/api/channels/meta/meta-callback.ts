import { NextRequest, NextResponse } from "next/server";
import { SignedRequestRefused } from "@server/channels/meta-callbacks.service";
import { DomainError } from "@server/shared/domain-error";
import { metaSignedRequestSchema } from "@/lib/validation/schemas/meta-callback.schema";
import { toErrorResponse } from "@/lib/api-error-response";
import { ERROR_RESPONSE_COPY } from "@/lib/lib-copy";

/**
 * Meta's signed account callbacks (meta-foundation D6, D7). The signed request authenticates the
 * caller, not a session; refusals carry no body, as Meta reads only the status.
 */
export async function signedRequestOf(req: NextRequest): Promise<string | null> {
  const form = await req.formData().catch(() => null);
  const parsed = metaSignedRequestSchema.safeParse({ signed_request: form?.get("signed_request") });
  return parsed.success ? parsed.data.signed_request : null;
}

/** Logged by kind only: a signed request carries a person's id. */
export function callbackFailed(error: unknown): NextResponse {
  if (error instanceof SignedRequestRefused) return new NextResponse(null, { status: 401 });
  console.error(JSON.stringify({ scope: "meta.callback", error: (error as Error | null)?.name ?? "unknown" }));
  return toErrorResponse(new DomainError(ERROR_RESPONSE_COPY.somethingWentWrong, { status: 503 }));
}
