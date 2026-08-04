import { baseEmailStyles } from "./styles/baseEmailStyles";

export function getVerificationEmailTemplate(verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Bhendi Bazaar</title>
        <style>
          ${baseEmailStyles}
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>
          
          <div class="header">
            <h1 class="logo">Bhendi Bazaar</h1>
            <p class="tagline">Royal Curation of Islamic Clothing</p>
          </div>
          
          <div class="content">
            <h2 class="greeting">Welcome to Bhendi Bazaar! 👋</h2>
            
            <p class="message">
              Thank you for joining our community. We're excited to have you here!
            </p>
            
            <p class="message">
              To complete your registration and start shopping our exclusive collection of Islamic clothing and boutique wear, please verify your email address.
            </p>
            
            <div class="cta-container">
              <a href="${verificationUrl}" class="button">
                ✓ Verify My Email
              </a>
            </div>
            
            <div class="expiry-notice">
              <p>
                <span class="expiry-icon">⏰</span>
                <strong>Important:</strong> This verification link will expire in 24 hours for security reasons.
              </p>
            </div>
            
            <hr class="divider">
            
            <div class="alternate-link">
              <p><strong>Can't click the button?</strong> Copy and paste this link into your browser:</p>
              <div class="link-text">${verificationUrl}</div>
            </div>
            
            <p class="message" style="margin-top: 30px; font-size: 14px; color: #666;">
              If you didn't create an account with Bhendi Bazaar, you can safely ignore this email.
            </p>
          </div>
          
          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">Need Help?</p>
            <p>Our support team is here to assist you.</p>
            
            <div class="social-links">
              <a href="#" class="social-link">Contact Us</a> •
              <a href="#" class="social-link">Privacy Policy</a> •
              <a href="#" class="social-link">Terms of Service</a>
            </div>
            
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