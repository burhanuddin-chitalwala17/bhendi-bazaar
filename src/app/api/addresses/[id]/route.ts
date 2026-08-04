/**
 * Address API Routes - Single Address Operations
 *
 * GET    /api/addresses/[id] - Get single address
 * PATCH  /api/addresses/[id] - Update address
 * DELETE /api/addresses/[id] - Delete address
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { addressService } from "@server/identity/address.service";
import { validateRequest } from "@/lib/validation";
import { updateAddressSchema } from "@/lib/validation/schemas/address.schema";

/**
 * GET /api/addresses/[id]
 * Fetch a single address by ID
 */
export async function GET(
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;
  const { id: addressId } = params;

  try {
    const address = await addressService.getAddressById(userId, addressId);
    return NextResponse.json(address);
  } catch (error) {
    console.error("Failed to fetch address:", error);
    
    if (error instanceof Error && error.message === "Address not found") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch address",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/addresses/[id]
 * Update an existing address
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;
  const { id: addressId } = params;

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update address" }, { status: 400 });
  }
}

/**
 * DELETE /api/addresses/[id]
 * Delete an address
 */
export async function DELETE(
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user).id;
  const { id: addressId } = params;

  try {
    const success = await addressService.deleteAddress(userId, addressId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete address" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Address deleted" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete address" }, { status: 400 });
  }
}