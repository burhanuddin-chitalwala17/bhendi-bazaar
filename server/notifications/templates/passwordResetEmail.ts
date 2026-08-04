import { baseEmailStyles } from "./styles/baseEmailStyles";

export function getPasswordResetEmailTemplate(
  resetUrl: string,
  userName: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Bhendi Bazaar</title>
        <style>
          ${baseEmailStyles}
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>
          
          <div class="header">
            <h1 class="logo">Bhendi Bazaar</h1>
            <p class="tagline">Password Reset Request</p>
          </div>
          
          <div class="content">
            <h2 class="greeting">Hello ${userName}! 🔐</h2>
            
            <p class="message">
              We received a request to reset your password for your Bhendi Bazaar account.
            </p>
            
            <p class="message">
              Click the button below to create a new password:
            </p>
            
            <div class="cta-container">
              <a href="${resetUrl}" class="button">
                Reset My Password
              </a>
            </div>
            
            <div class="expiry-notice">
              <p>
                <span class="expiry-icon">⏰</span>
                <strong>Important:</strong> This link will expire in 1 hour for security reasons.
              </p>
            </div>
            
            <hr class="divider">
            
            <div class="alternate-link">
              <p><strong>Can't click the button?</strong> Copy and paste this link into your browser:</p>
              <div class="link-text">${resetUrl}</div>
            </div>
            
            <p class="message" style="margin-top: 30px; font-size: 14px; color: #666;">
              <strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed.
            </p>
          </div>
          
          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">Need Help?</p>
            <p>Contact our support team if you didn't request this reset.</p>
            
            <p class="copyright">
              &copy; ${new Date().getFullYear()} Bhendi Bazaar. All rights reserved.
            </p>
          </div>
          
          <div class="accent-bar"></div>
        </div>
      </body>
    </html>
  `;
}