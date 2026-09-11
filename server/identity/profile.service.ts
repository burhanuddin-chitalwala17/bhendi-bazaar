/**
 * Server-side Profile Service
 *
 * This service encapsulates all business logic related to user profiles.
 * It acts as an intermediary between API routes and the repository layer.
 */

import { profileRepository } from "@server/identity/profile.repository";
import { prisma } from "@server/shared/prisma";
import type {
  ServerProfileData,
  UpdateProfileInput,
} from "@server/identity/profile.types";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { isValidPhone, PHONE_MESSAGE } from "@server/shared/phone";

export class ProfileService {
  /**
   * Get profile for a user
   */
  async getProfile(userId: string): Promise<ServerProfileData> {
    const profile = await profileRepository.getByUserId(userId);

    if (!profile) {
      throw new NotFoundError("User not found");
    }

    return profile;
  }

  /**
   * Update user profile with validation
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<ServerProfileData> {
    // Validate input (includes uniqueness checks)
    await this.validateUpdateInput(userId, input);

    // Update profile
    const updated = await profileRepository.update(userId, input);

    return updated;
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: string): Promise<void> {
    await profileRepository.delete(userId);
  }

  /**
   * Validate update input
   */
  private async validateUpdateInput(
    userId: string,
    input: UpdateProfileInput
  ): Promise<void> {
    // Validate email format if provided
    if (input.email !== undefined && input.email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email)) {
        throw new DomainError("Invalid email format");
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictError("This email is already registered to another account");
      }
    }

    if (input.mobile !== undefined && input.mobile !== null) {
      if (!isValidPhone(input.mobile)) {
        throw new DomainError(PHONE_MESSAGE);
      }

      // Check if mobile is already taken by another user
      const existingMobile = await prisma.user.findUnique({
        where: { mobile: input.mobile },
        select: { id: true },
      });

      if (existingMobile && existingMobile.id !== userId) {
        throw new ConflictError("This mobile number is already registered to another account");
      }
    }

    // Validate addresses if provided
    if (input.addresses !== undefined && input.addresses !== null) {
      if (!Array.isArray(input.addresses)) {
        throw new DomainError("Addresses must be an array");
      }

      for (const address of input.addresses) {
        if (
          !address.addressLine1 ||
          !address.city ||
          !address.country ||
          !address.pincode 
        ) {
          throw new DomainError("Address is missing required fields");
        }
      }
    }

    // Validate profile picture URL if provided
    if (input.profilePic !== undefined && input.profilePic !== null) {
      try {
        new URL(input.profilePic);
      } catch {
        throw new DomainError("Profile picture must be a valid URL");
      }
    }
  }
}

export const profileService = new ProfileService();
