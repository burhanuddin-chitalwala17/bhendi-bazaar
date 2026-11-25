import { NOTIFICATIONS_COPY } from "@server/notifications/notifications-copy";
import { alternateLink, button, esc, paragraph, renderEmail } from "./layout";

const COPY = NOTIFICATIONS_COPY.statusDue;

/** The one shop alert that cannot wait for the morning (notifications-core R5, whatsapp-status-kit Q9). */
export function renderStatusDueEmail(view: { count: number; url: string }): { subject: string; html: string } {
  return {
    subject: COPY.subject,
    html: renderEmail({
      title: COPY.subject,
      tagline: COPY.tagline,
      body: `
            ${paragraph(esc(COPY.body(view.count)))}

            ${button(view.url, COPY.button)}

            ${alternateLink(view.url)}`,
    }),
  };
}
