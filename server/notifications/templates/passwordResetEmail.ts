import {
  alternateLink,
  button,
  closingNote,
  greeting,
  noticeBox,
  paragraph,
  renderEmail,
} from "./layout";

export function getPasswordResetEmailTemplate(
  resetUrl: string,
  userName: string
): string {
  return renderEmail({
    title: "Reset Your Password",
    tagline: "Password Reset Request",
    body: `
            ${greeting(`Hello ${userName}! 🔐`)}

            ${paragraph(
              "We received a request to reset your password for your Bhendi Bazaar account."
            )}

            ${paragraph("Click the button below to create a new password:")}

            ${button(resetUrl, "Reset My Password")}

            ${noticeBox(
              "<strong>Important:</strong> This link will expire in 1 hour for security reasons."
            )}

            ${alternateLink(resetUrl)}

            ${closingNote(
              "<strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed."
            )}`,
    footer: {
      note: "Contact our support team if you didn't request this reset.",
    },
  });
}
