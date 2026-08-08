/**
 * Address API Routes - Single Address Operations
 *
 * GET    /api/addresses/[id] - Get single address
 * PATCH  /api/addresses/[id] - Update address
 * DELETE /api/addresses/[id] - Delete address
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { addressService } from "@server/identity/address.service";
import { validateRequest } from "@/lib/validation";
import { updateAddressSchema } from "@/lib/validation/schemas/address.schema";
import { toErrorResponse } from "@/lib/api-error-response";

// Next passes (request, context); `params` is a Promise in Next 15+.
type RouteParams = { params: Promise<{ id: string }> };


/**
 * PATCH /api/addresses/[id]
 * Update an existing address
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;
  const { id: addressId } = await params;

  // Validate request body
  const validation = await validateRequest(req, updateAddressSchema);

  if ("error" in validation) {
    return validation.error;
  }

  try {

    const success = await addressService.updateAddress(
      userId,
      addressId,
      validation.data
    );
    if (!success) {
      return NextResponse.json({ error: "Failed to update address" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Address updated" });
  } catch (error) {
    return toErrorResponse(error, "Could not update address");
  }
}

/**
 * DELETE /api/addresses/[id]
 * Delete an address
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;
  const { id: addressId } = await params;

  try {
    const success = await addressService.deleteAddress(userId, addressId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete address" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Address deleted" });
  } catch (error) {
    return toErrorResponse(error, "Could not delete address");
  }
}