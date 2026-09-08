/**
 * Address API Routes
 *
 * GET  /api/addresses - Get all addresses for authenticated user
 * POST /api/addresses - Add a new address
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { addressService } from "@server/identity/address.service";
import { validateRequest } from "@/lib/validation";
import { addAddressSchema } from "@/lib/validation/schemas/address.schema";
import { toErrorResponse } from "@/lib/api-error-response";

/**
 * GET /api/addresses
 * Fetch all addresses for the authenticated user
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const addresses = await addressService.getAddressesByUserId(userId);
    return NextResponse.json({ addresses });
  } catch (error) {
    return toErrorResponse(error, "Could not fetch addresses");
  }
}

/**
 * POST /api/addresses
 * Add a new address for the authenticated user
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;

  // Validate request body
  const validation = await validateRequest(req, addAddressSchema);

  if ("error" in validation) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const success = await addressService.addAddress(userId, validation.data);
    if (!success) {
      return NextResponse.json({ error: "Failed to add address" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Address added" }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not add address");
  }
}