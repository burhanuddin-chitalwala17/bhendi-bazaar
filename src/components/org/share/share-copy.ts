/** The share sheet's words (own-store onboarding ux.md, Share sheet state matrix and copy deck). */
export const SHARE_COPY = {
  open: "Share",
  title: "Share your shop",
  whatsapp: "Share on WhatsApp",
  copyLink: "Copy link",
  seeAsBuyer: "See as a buyer",
  copied: "Link copied",
  /** Said in the sheet after a copy: the way on for a phone without WhatsApp (ux journey 5). */
  pasteAnywhere: "Copied. Paste it in any chat.",
  copyFailed: "Long-press the link to copy it.",
  shared: "Shared",
  close: "Close",
} as const;

/** The copy deck's WhatsApp message. */
export function shareMessage(shopName: string, url: string): string {
  return `Visit ${shopName} online: ${url}`;
}

/** WhatsApp's own share link: it opens the app, or its web page where the app is missing. */
export function whatsappHref(shopName: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(shopName, url))}`;
}

