import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { contactMessageListSchema } from "@/lib/validation/schemas/contact.schema";
import { contactService } from "@server/support/contact.service";

/** GET /api/admin/contact — the portal's inbox for Contact us messages. */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    // Parsed, not read field by field with casts: a query string is as untrusted as a
    // body, and the schema owns the page/limit bounds (Invariant 4).
    const filters = contactMessageListSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    return NextResponse.json(await contactService.getMessages(filters));
  } catch (error) {
    return toErrorResponse(error, "Could not fetch messages");
  }
}
