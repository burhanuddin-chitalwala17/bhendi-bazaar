/**
 * Profile API Routes
 *
 * These routes handle profile-related operations.
 * They delegate business logic to the ProfileService.
 */

import { NextResponse } from "next/server";

import { requireSession } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { profileService } from "@server/identity/profile.service";
import { validateRequest } from "@/lib/validation";
import { updateProfileSchema } from "@/lib/validation/schemas/profile.schemas";

export async function GET() {
  try {
    const session = await requireSession();
    const profile = await profileService.getProfile(session.user.id);
    return NextResponse.json(profile);
  } catch (error) {
    return toErrorResponse(error, "Failed to fetch profile");
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();

    // Validate request body
    const validation = await validateRequest(req, updateProfileSchema);

    if ("error" in validation) {
      return validation.error;
    }

    const updated = await profileService.updateProfile(
      session.user.id,
      validation.data
    );
    return NextResponse.json(updated);
  } catch (error) {
    // A flat 400 here collapsed every failure into one status — a wrong password
    // read the same as a duplicate address. The envelope keeps them apart.
    return toErrorResponse(error, "Failed to update profile");
  }
}
