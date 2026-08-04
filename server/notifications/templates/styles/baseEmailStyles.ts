/**
 * Base styles shared across all email templates
 */
export const baseEmailStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    background: #f8f8f8;
    padding: 20px;
  }
  .email-wrapper {
    max-width: 600px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  }
  .header {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    padding: 40px 30px;
    text-align: center;
    border-bottom: 4px solid #d4af37;
  }
  .logo {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .tagline {
    color: #d4af37;
    font-size: 13px;
    margin-top: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .content {
    padding: 40px 30px;
  }
  .greeting {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 20px;
  }
  .message {
    font-size: 16px;
    color: #4a4a4a;
    margin-bottom: 15px;
    line-height: 1.7;
  }
  .cta-container {
    text-align: center;
    margin: 35px 0;
  }
  .button { 
    display: inline-block;
    padding: 16px 40px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.5px;
    transition: transform 0.2s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 2px solid #d4af37;
  }
  .button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  .divider {
    margin: 30px 0;
    border: 0;
    border-top: 1px solid #e5e5e5;
  }
  .alternate-link {
    background: #f8f8f8;
    padding: 20px;
    border-radius: 8px;
    border: 1px dashed #d4af37;
    margin: 25px 0;
  }
  .alternate-link p {
    font-size: 13px;
    color: #666;
    margin-bottom: 8px;
  }
  .link-text {
    word-break: break-all;
    color: #1a1a1a;
    font-size: 12px;
    font-family: monospace;
    background: #ffffff;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #e5e5e5;
  }
  .expiry-notice {
    background: #fff9e6;
    border-left: 4px solid #d4af37;
    padding: 15px;
    margin: 25px 0;
    border-radius: 4px;
  }
  .expiry-notice p {
    font-size: 14px;
    color: #8b7123;
    margin: 0;
  }
  .expiry-icon {
    display: inline-block;
    margin-right: 8px;
  }
  .footer {
    background: #f8f8f8;
    padding: 30px;
    text-align: center;
    border-top: 1px solid #e5e5e5;
  }
  .footer p {
    color: #666;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .social-links {
    margin: 20px 0;
  }
  .social-link {
    display: inline-block;
    margin: 0 8px;
    color: #666;
    text-decoration: none;
    font-size: 12px;
  }
  .copyright {
    color: #999;
    font-size: 12px;
    margin-top: 15px;
  }
  .accent-bar {
    height: 4px;
    background: linear-gradient(90deg, #d4af37 0%, #f4d775 50%, #d4af37 100%);
  }
  @media only screen and (max-width: 600px) {
    .email-wrapper {
      border-radius: 0;
    }
    .header, .content, .footer {
      padding: 25px 20px;
    }
    .logo {
      font-size: 26px;
    }
    .greeting {
      font-size: 20px;
    }
    .button {
      padding: 14px 30px;
      font-size: 15px;
    }
  }
`;