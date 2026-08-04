/**
 * Profile API Routes
 *
 * These routes handle profile-related operations.
 * They delegate business logic to the ProfileService.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { profileService } from "@server/identity/profile.service";
import { validateRequest } from "@/lib/validation";
import { updateProfileSchema } from "@/lib/validation/schemas/profile.schemas";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    const profile = await profileService.getProfile(userId);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch profile",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  // Validate request body
  const validation = await validateRequest(req, updateProfileSchema);

  if ("error" in validation) {
    return validation.error;
  }

  try {
    const updated = await profileService.updateProfile(
      userId,
      validation.data
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      },
      { status: 400 }
    );
  }
}
