import { appUrl } from "@server/shared/app-url";
import { closingNote, esc, greeting, paragraph, renderEmail } from "./layout";

export interface OrgEmailChangedView {
  shopName: string;
}

/**
 * Sent to the address a shop just left (org-profile Q16): no code was asked, so this notice is
 * what catches a change the owner did not make. It names no new address — the old inbox may not
 * be the owner's any more.
 */
export function getOrgEmailChangedEmailTemplate(view: OrgEmailChangedView): string {
  return renderEmail({
    title: "Your shop's email was changed",
    tagline: "Your shop",
    body: `
            ${greeting("Hello!")}

            ${paragraph(
              `The email for order updates on <strong>${esc(view.shopName)}</strong> was changed, so new orders no longer come to this address.`
            )}

            ${paragraph(`If you made this change, there is nothing to do.`)}

            ${closingNote(
              `Didn't change it? Sign in at ${esc(appUrl())} and check Shop details, or reply to this email and we'll help.`
            )}`,
  });
}
