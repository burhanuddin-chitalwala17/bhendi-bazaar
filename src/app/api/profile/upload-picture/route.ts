import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { prisma } from "@server/shared/prisma";
import { normalizeImage } from "@server/catalog/image-upload";
import { deleteObject, putObject } from "@server/catalog/object-store";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // 4. Get user's current profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 5. Delete old profile picture from blob (if exists)
    if (user.profile?.profilePic) {
      try {
        await deleteObject(user.profile.profilePic);
      } catch (error) {
        console.error("Failed to delete old profile picture:", error);
        // Continue anyway - old blob will be orphaned but won't break upload
      }
    }

    // 6. Upload new file to Vercel Blob, downscaled first — an avatar is shown at 96px
    // and was being stored at whatever the phone produced (ADR-0026).
    const { body, extension, contentType } = await normalizeImage(file);
    const filename = `profile/${userId}-${Date.now()}.${extension}`;

    const uploadedUrl = await putObject(filename, body, contentType);

    // 7. Update profile with new blob URL
    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        profilePic: uploadedUrl,
      },
      update: {
        profilePic: uploadedUrl,
      },
    });

    // 8. Return success
    return NextResponse.json({
      url: uploadedUrl,
      message: "Profile picture uploaded successfully",
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload profile picture" },
      { status: 500 }
    );
  }
}

// Optional: DELETE endpoint to remove profile picture
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user?.profile?.profilePic) {
      return NextResponse.json(
        { error: "No profile picture to delete" },
        { status: 404 }
      );
    }

    await deleteObject(user.profile.profilePic);

    // Update profile
    await prisma.profile.update({
      where: { userId },
      data: { profilePic: null },
    });

    return NextResponse.json({ message: "Profile picture deleted" });
  } catch (error) {
    console.error("Profile picture delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete profile picture" },
      { status: 500 }
    );
  }
}