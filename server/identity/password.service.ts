/**
 * Server-side Password Service
 * 
 * Handles password change and reset operations
 */

import { profileRepository } from "@server/identity/profile.repository";
import { hash, compare } from "bcryptjs";
import crypto from "crypto";

// Reset tokens share VerificationToken with email verification; the prefix tells them apart.
const PASSWORD_RESET_PREFIX = "password-reset:";

export class PasswordService {
  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user with password hash
      const user = await profileRepository.findPasswordHash(userId);

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check if user has a password (might be OAuth user)
      if (!user.passwordHash) {
        return {
          success: false,
          error: "Cannot change password for OAuth accounts",
        };
      }

      // Verify current password
      const isValid = await compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return { success: false, error: "Current password is incorrect" };
      }

      // Hash new password
      const newPasswordHash = await hash(newPassword, 10);

      // Update password
      await profileRepository.updatePasswordHash(userId, newPasswordHash);

      return { success: true };
    } catch (error) {
      console.error("Change password error:", error);
      return { success: false, error: "Failed to change password" };
    }
  }

  /**
   * Request password reset (send email)
   */
  async requestPasswordReset(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Find user by email
      const user = await profileRepository.findPasswordResetCandidate(email);

      // Always return success even if user not found (security)
      if (!user) {
        return { success: true };
      }

      // No password and an address nobody proved: nothing to reset, and nothing revealed. A verified
      // account with no password (Google-only, or one whose unverified password was cleared at a
      // Google claim) may set one: the link goes to the inbox that proved the address.
      if (!user.passwordHash && !user.isEmailVerified) {
        return { success: true };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in VerificationToken table (reusing existing table)
      await profileRepository.createVerificationToken(
        `${PASSWORD_RESET_PREFIX}${user.id}`,
        resetToken,
        expires,
      );

      // Send reset email
      const { emailService } = await import("@server/notifications/email.service");
      await emailService.sendPasswordResetEmail(email, resetToken, user.name || "User");

      return { success: true };
    } catch (error) {
      console.error("Request password reset error:", error);
      return { success: false, error: "Failed to send reset email" };
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find token with password-reset prefix
      const resetToken = await profileRepository.findTokenWithIdentifierPrefix(
        token,
        PASSWORD_RESET_PREFIX,
      );

      if (!resetToken) {
        return { success: false, error: "Invalid or expired reset link" };
      }

      // Check if token has expired
      if (resetToken.expires < new Date()) {
        // Delete expired token (use deleteMany to handle concurrent requests)
        await profileRepository.deleteVerificationToken(resetToken.token);
        return { success: false, error: "Reset link has expired" };
      }

      // Extract user ID from identifier
      const userId = resetToken.identifier.replace(PASSWORD_RESET_PREFIX, "");

      // Hash new password
      const passwordHash = await hash(newPassword, 10);

      // Update password
      await profileRepository.updatePasswordHash(userId, passwordHash);

      // Delete used token (use deleteMany to handle concurrent requests)
      await profileRepository.deleteVerificationToken(resetToken.token);

      return { success: true };
    } catch (error) {
      console.error("Reset password error:", error);
      return { success: false, error: "Failed to reset password" };
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: "Password must be at least 8 characters" };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        error: "Password must contain at least one uppercase letter",
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        error: "Password must contain at least one lowercase letter",
      };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: "Password must contain at least one number" };
    }

    return { valid: true };
  }
}

export const passwordService = new PasswordService();