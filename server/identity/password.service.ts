/**
 * Server-side Password Service
 * 
 * Handles password change and reset operations
 */

import { prisma } from "@server/shared/prisma";
import { hash, compare } from "bcryptjs";
import crypto from "crypto";

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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

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
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

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
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true, name: true },
      });

      // Always return success even if user not found (security)
      if (!user) {
        return { success: true };
      }

      // Check if user has a password (might be OAuth user)
      if (!user.passwordHash) {
        return { success: true }; // Don't reveal OAuth users
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in VerificationToken table (reusing existing table)
      await prisma.verificationToken.create({
        data: {
          identifier: `password-reset:${user.id}`,
          token: resetToken,
          expires,
        },
      });

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
      const resetToken = await prisma.verificationToken.findFirst({
        where: {
          token,
          identifier: {
            startsWith: "password-reset:",
          },
        },
      });

      if (!resetToken) {
        return { success: false, error: "Invalid or expired reset link" };
      }

      // Check if token has expired
      if (resetToken.expires < new Date()) {
        // Delete expired token (use deleteMany to handle concurrent requests)
        await prisma.verificationToken.deleteMany({
          where: { token: resetToken.token },
        });
        return { success: false, error: "Reset link has expired" };
      }

      // Extract user ID from identifier
      const userId = resetToken.identifier.replace("password-reset:", "");

      // Hash new password
      const passwordHash = await hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Delete used token (use deleteMany to handle concurrent requests)
      await prisma.verificationToken.deleteMany({
        where: { token: resetToken.token },
      });

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