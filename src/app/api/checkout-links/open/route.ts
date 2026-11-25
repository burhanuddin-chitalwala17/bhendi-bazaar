import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { optionalActiveSession } from "@/lib/admin-auth";
import { limitRequest } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";
import { validateRequest } from "@/lib/validation";
import { openCheckoutLinkSchema } from "@/lib/validation/schemas/checkout-link.schemas";
import { checkoutLinkService } from "@server/cart/checkout-link.service";

/** Names a guest's device, so a link opens once per cart without an account (checkout-links D3). */
const DEVICE_COOKIE = "bb_device";
const DEVICE_ID = /^[0-9a-f-]{36}$/;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** POST /api/checkout-links/open — the lines a link adds to this cart, once. */
export async function POST(request: NextRequest) {
  try {
    const session = await optionalActiveSession({ onBlocked: "guest" });
    const limited = await limitRequest(request, "POST /api/checkout-links/open", { userId: session?.user?.id });
    if (limited) return limited;

    const validation = await validateRequest(request, openCheckoutLinkSchema);
    if ("error" in validation) return validation.error;

    const known = request.cookies.get(DEVICE_COOKIE)?.value;
    const deviceId = known && DEVICE_ID.test(known) ? known : randomUUID();
    const cartKey = session?.user?.id ? `user:${session.user.id}` : `device:${deviceId}`;

    const result = await checkoutLinkService.open(validation.data.shop, validation.data.token, cartKey);
    const response = NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    if (deviceId !== known) {
      response.cookies.set(DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
      });
    }
    return response;
  } catch (error) {
    return toErrorResponse(error, "Could not open the link");
  }
}
