/**
 * Server-side Profile Repository
 *
 * This repository handles all database operations for user profiles.
 * It uses Prisma to interact with the PostgreSQL database.
 */

import { prisma } from "@server/shared/prisma";
import type {
  ServerProfileData,
  UpdateProfileInput,
  DeliveryAddress
} from "@server/identity/profile.types";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
/**
 * Helper to normalize addresses from database JSON
 */
function normalizeAddresses(addresses: unknown): DeliveryAddress[] {
  if (!addresses) return [];
  if (Array.isArray(addresses)) {
    return addresses as DeliveryAddress[];
  }
  return [];
}

export class ProfileRepository {
  /**
   * Get user profile by user ID
   * Creates a profile if it doesn't exist
   */
  async getByUserId(userId: string): Promise<ServerProfileData | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    // Create profile if it doesn't exist
    const profile =
      user.profile ??
      (await prisma.profile.create({
        data: {
          userId: user.id,
          addresses: [],
        },
      }));

    return {
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
        mobile: user.mobile ?? null,
        isEmailVerified: user.isEmailVerified,
        emailVerifiedAt: user.emailVerified ?? null,
      },
      profile: {
        id: profile.id,
        userId: profile.userId,
        profilePic: profile.profilePic,
        addresses: normalizeAddresses(profile.addresses),
      },
    };
  }

  /**
   * Update user and profile information
   */
  async update(
    userId: string,
    input: UpdateProfileInput
  ): Promise<ServerProfileData> {
    const { name, email, mobile, profilePic, addresses } = input;

    // Check if email is changing
    let isEmailChanging = false;
    if (email !== undefined) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      isEmailChanging = email !== currentUser?.email;

      // Additional safeguard: Check if new email is already taken
      if (isEmailChanging && email) {
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== userId) {
          throw new ConflictError("This email is already registered to another account");
        }
      }
    }

    // Check if mobile is changing and already taken
    if (mobile !== undefined) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { mobile: true },
      });
      const isMobileChanging = mobile !== currentUser?.mobile;

      if (isMobileChanging && mobile) {
        const existingMobile = await prisma.user.findUnique({
          where: { mobile },
          select: { id: true },
        });

        if (existingMobile && existingMobile.id !== userId) {
          throw new ConflictError("This mobile number is already registered to another account");
        }
      }
    }

    // Update User table if user fields are provided
    if (name !== undefined || email !== undefined || mobile !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && {
            email,
            // If email is changing, mark as unverified
            ...(isEmailChanging && { isEmailVerified: false }),
          }),
          ...(mobile !== undefined && { mobile }),
        },
      });

      // If email changed, send verification email
      if (isEmailChanging && email) {
        try {
          const { emailService } = await import(
            "@server/notifications/email.service"
          );
          // Delete any existing verification tokens
          await prisma.verificationToken.deleteMany({
            where: { identifier: userId },
          });
          // Send new verification email
          await emailService.sendVerificationEmail(userId, email);
          console.log(`✅ Verification email sent to new address: ${email}`);
        } catch (emailError) {
          console.error("Failed to send verification email:", emailError);
          // Don't fail the update if email sending fails
        }
      }
    }

    // Get the user with profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update or create profile
    const nextProfile = await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        profilePic: profilePic ?? null,
        addresses: (addresses ?? []) as any,
      },
      update: {
        ...(profilePic !== undefined && { profilePic }),
        ...(addresses !== undefined && { addresses: addresses as any }),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
        mobile: user.mobile ?? null,
        isEmailVerified: user.isEmailVerified,
        emailVerifiedAt: user.emailVerified ?? null,
      },
      profile: {
        id: nextProfile.id,
        userId: nextProfile.userId,
        profilePic: nextProfile.profilePic,
        addresses: normalizeAddresses(nextProfile.addresses),
      },
    };
  }

  /**
   * Delete user profile
   */
  async delete(userId: string): Promise<void> {
    await prisma.profile.delete({
      where: { userId },
    });
  }
}

export const profileRepository = new ProfileRepository();
