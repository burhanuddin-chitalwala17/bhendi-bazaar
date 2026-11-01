/** The storefront editor's refusals (storefront-themes ux.md: section sheet), worded once for server and sheet. */

/** Stale: another member saved since the sheet read the shop. */
export const changedBy = (name: string | null) => `Changed by ${name?.trim() || "another member"} just now. Load theirs?`;

/** Terminal error: a file that is not one of this shop's pictures. */
export const NOT_A_PHOTO = "Use a photo, not a PDF.";
