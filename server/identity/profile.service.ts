/**
 * Server-side Profile Service
 *
 * This service encapsulates all business logic related to user profiles.
 * It acts as an intermediary between API routes and the repository layer.
 */

import { compare } from "bcryptjs";

import { profileRepository } from "@server/identity/profile.repository";
import { prisma } from "@server/shared/prisma";
import type {
  ServerProfileData,
  UpdateProfileInput,
} from "@server/identity/profile.types";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from "@server/shared/domain-error";

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

    // The address is the account's recovery channel, so moving it is a takeover if
    // a borrowed session is enough. Re-authenticate before anything is written.
    await this.authoriseEmailChange(userId, input);

    // The password is proof, never stored state — it must not reach the repository.
    const { currentPassword: _currentPassword, ...persistable } = input;

    // Update profile
    const updated = await profileRepository.update(userId, persistable);

    return updated;
  }

  /**
   * Require the account password when — and only when — the email is actually
   * changing. Re-sending the same address is not a change, so a name edit that
   * echoes the current email back does not demand a password.
   */
  private async authoriseEmailChange(
    userId: string,
    input: UpdateProfileInput
  ): Promise<void> {
    if (input.email === undefined || input.email === null) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (input.email === user.email) return;

    // An account that signs in through Google has no password to re-enter, and its
    // address is the provider's to change — there is no proof we could ask for here.
    if (!user.passwordHash) {
      throw new ForbiddenError(
        "This account signs in with Google, so its email is managed there and cannot be changed here"
      );
    }

    if (!input.currentPassword) {
      throw new DomainError("Enter your current password to change your email", {
        status: 401,
        field: "currentPassword",
      });
    }

    const isValid = await compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new DomainError("Current password is incorrect", {
        status: 401,
        field: "currentPassword",
      });
    }
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

    // Validate mobile format if provided (basic validation)
    if (input.mobile !== undefined && input.mobile !== null) {
      const mobileRegex = /^\d{10}$/;
      if (!mobileRegex.test(input.mobile)) {
        throw new DomainError("Mobile number must be 10 digits");
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
