import {
  alternateLink,
  button,
  closingNote,
  greeting,
  noticeBox,
  paragraph,
  renderEmail,
} from "./layout";

export function getVerificationEmailTemplate(verificationUrl: string): string {
  return renderEmail({
    title: "Verify Your Email",
    body: `
            ${greeting("Welcome to Bhendi Bazaar! 👋")}

            ${paragraph("Thank you for joining our community. We're excited to have you here!")}

            ${paragraph(
              "To complete your registration and start shopping our exclusive collection of Islamic clothing and boutique wear, please verify your email address."
            )}

            ${button(verificationUrl, "✓ Verify My Email")}

            ${noticeBox(
              "<strong>Important:</strong> This verification link will expire in 24 hours for security reasons."
            )}

            ${alternateLink(verificationUrl)}

            ${closingNote(
              "If you didn't create an account with Bhendi Bazaar, you can safely ignore this email."
            )}`,
    footer: {
      links: [
        { label: "Contact Us", href: "#" },
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
      ],
    },
  });
}
