import { NOTIFICATIONS_COPY } from "@server/notifications/notifications-copy";
import { button, closingNote, esc, paragraph, renderEmail } from "./layout";

const COPY = NOTIFICATIONS_COPY.morning;

export interface MorningEmailView {
  shop: string;
  /** One line per kind still waiting, already worded, each with the screen that fixes it. */
  lines: { text: string; count: number; url: string }[];
  settingsUrl: string;
}

/** The 9 am email: what is still waiting at one shop, one line and one button per kind (notifications-core R4). */
export function renderMorningEmail(view: MorningEmailView): { subject: string; html: string } {
  const total = view.lines.reduce((n, line) => n + line.count, 0);
  const subject = COPY.subject(total, view.shop);
  return {
    subject,
    html: renderEmail({
      title: subject,
      tagline: COPY.tagline,
      body: `
            ${view.lines.map((line) => `${paragraph(esc(line.text))}\n            ${button(line.url, COPY.button)}`).join("\n")}

            ${closingNote(`${esc(COPY.footer)} <a href="${esc(view.settingsUrl)}">${esc(COPY.footerLink)}</a>.`)}`,
    }),
  };
}
