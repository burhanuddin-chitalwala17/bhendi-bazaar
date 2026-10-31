export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    /** Where the recipient's Reply goes, when that is not the From address. */
    replyTo?: string;
    /** The provider sends one email per key, so a retried job never mails twice. */
    idempotencyKey?: string;
  }
