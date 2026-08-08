/**
 * Server-side Email Service
 *
 * Handles all email-related operations including:
 * - Sending verification emails
 * - Verifying email tokens
 * - Managing verification tokens in database
 * - Sending purchase confirmations
 */

import { prisma } from "@server/shared/prisma";
import { appUrl } from "@server/shared/app-url";
import crypto from "crypto";
import { Resend } from "resend";
import type { OrderEmailView } from "@server/notifications/templates/purchaseConfirmationEmail";
import type { SendEmailOptions } from "./types";
import { getVerificationEmailTemplate } from "./templates/verificationEmail";
import { getPasswordResetEmailTemplate } from "./templates/passwordResetEmail";
import { getPurchaseConfirmationEmailTemplate } from "./templates/purchaseConfirmationEmail";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    } else {
      console.warn(
        "⚠️  RESEND_API_KEY not configured. Email sending will fail in production."
      );
    }
  }

  /**
   * Send email using configured email provider
   */
  private async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.resend) {
      throw new Error("Resend not initialized");
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || "Bhendi Bazaar <onboarding@resend.dev>",
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error("❌ Resend API error:", error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log(
        `✅ Email sent successfully to ${options.to} (ID: ${data?.id})`
      );
    } catch (error) {
      console.error("❌ Failed to send email:", error);
      throw error;
    }
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: userId,
        token,
        expires,
      },
    });

    const verificationUrl = `${appUrl()}/api/auth/verify-email?token=${token}`;

    await this.sendEmail({
      to: email,
      subject: "Verify your email - Bhendi Bazaar",
      html: getVerificationEmailTemplate(verificationUrl),
    });
  }

  /**
   * Verify email using token
   */
  async verifyEmail(
    token: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
      });

      if (!verificationToken) {
        return { success: false, error: "Invalid verification token" };
      }

      if (verificationToken.expires < new Date()) {
        await prisma.verificationToken.deleteMany({
          where: { token },
        });
        return { success: false, error: "Verification token has expired" };
      }

      await prisma.user.update({
        where: { id: verificationToken.identifier },
        data: {
          isEmailVerified: true,
          emailVerified: new Date(),
        },
      });

      await prisma.verificationToken.deleteMany({
        where: { token },
      });

      return { success: true };
    } catch (error) {
      console.error("Email verification error:", error);
      return { success: false, error: "Failed to verify email" };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isEmailVerified: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.isEmailVerified) {
      throw new ConflictError("Email already verified");
    }

    if (!user.email) {
      throw new DomainError("No email associated with this account");
    }

    await prisma.verificationToken.deleteMany({
      where: { identifier: userId },
    });

    await this.sendVerificationEmail(userId, user.email);
  }

  /**
   * Get verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<{
    isVerified: boolean;
    email: string | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isEmailVerified: true, email: true },
    });

    return {
      isVerified: user?.isEmailVerified ?? false,
      email: user?.email ?? null,
    };
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string
  ): Promise<void> {
    const resetUrl = `${appUrl()}/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to: email,
      subject: "Reset your password - Bhendi Bazaar",
      html: getPasswordResetEmailTemplate(resetUrl, userName),
    });
  }

  /**
   * Send purchase confirmation email
   */
  async sendPurchaseConfirmationEmail(
    order: OrderEmailView,
    customerEmail: string
  ): Promise<void> {
    await this.sendEmail({
      to: customerEmail,
      subject: `Order Confirmation #${order.code} - Bhendi Bazaar`,
      html: getPurchaseConfirmationEmailTemplate(order),
    });
  }
}

export const emailService = new EmailService();