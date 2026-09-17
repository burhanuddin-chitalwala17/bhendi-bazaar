import { detailPanel, esc, paragraph, renderEmail, type DetailRow } from "./layout";

/** A Contact us message, as the store's inbox receives it (docs/specs/contact-us/). */
export interface ContactMessageEmailView {
  subject: string;
  message: string;
  /** Where a reply goes — also set as the email's Reply-To. */
  replyEmail: string;
  /** The account's name when signed in; null for a guest. */
  senderName: string | null;
  signedIn: boolean;
}

/** Sent to the store, not to a buyer: the store's inbox is the whole of Contact us's back end. */
export function getContactMessageEmailTemplate(view: ContactMessageEmailView): string {
  const rows: DetailRow[] = [
    { label: "From", value: esc(view.senderName ?? "Guest") },
    { label: "Reply to", value: esc(view.replyEmail) },
    { label: "Account", value: view.signedIn ? "Signed in" : "Guest" },
    { label: "Subject", value: esc(view.subject), final: true },
  ];

  return renderEmail({
    title: "New Contact us message",
    tagline: "Contact us",
    body: `
            ${detailPanel(rows)}

            ${paragraph(esc(view.message).replace(/\r?\n/g, "<br />"))}

            ${paragraph("Reply to this email to answer the sender directly.", "margin-top: 30px; font-size: 14px; color: #666;")}`,
  });
}
