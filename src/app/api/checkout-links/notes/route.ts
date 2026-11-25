import { NextRequest, NextResponse } from "next/server";
import { optionalActiveSession } from "@/lib/admin-auth";
import { limitRequest } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";
import { validateRequest } from "@/lib/validation";
import { checkoutLinkNotesSchema } from "@/lib/validation/schemas/checkout-link.schemas";
import { checkoutLinkService } from "@server/cart/checkout-link.service";

/** POST /api/checkout-links/notes — what checkout says about the links its lines came from (checkout-links D4). */
export async function POST(request: NextRequest) {
  try {
    const session = await optionalActiveSession({ onBlocked: "guest" });
    const limited = await limitRequest(request, "POST /api/checkout-links/notes", { userId: session?.user?.id });
    if (limited) return limited;

    const validation = await validateRequest(request, checkoutLinkNotesSchema);
    if ("error" in validation) return validation.error;

    const notes = await checkoutLinkService.notes(validation.data.links);
    return NextResponse.json(notes, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error, "Could not read the link");
  }
}
