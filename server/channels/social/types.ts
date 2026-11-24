/**
 * Our words for the social platforms (social-selling TRD A-D3, A-D4). Nothing here is a Meta field
 * name: the Graph client and the translators map Meta's shapes into these, and every tool domain
 * speaks only these.
 */

/** The two Meta products a shop connects, each its own social channel (ADR-0068). */
export const SOCIAL_PLATFORM = {
  INSTAGRAM: "instagram",
  WHATSAPP: "whatsapp",
} as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORM)[keyof typeof SOCIAL_PLATFORM];

/**
 * Why a call to a platform did not do what we asked: our code, never the platform's text
 * (meta-foundation R9). The UI maps each to ux.md's sentence.
 */
export const SOCIAL_ERROR = {
  /** Our access is gone: expired, revoked, or the app removed. The shop must reconnect. */
  AUTH: "auth",
  /** The account lacks a permission we asked for, or turned off message access. */
  PERMISSION: "permission",
  /** Too many calls; slow down and try after the platform's reset. */
  RATE_LIMITED: "rate_limited",
  /** The platform did not answer or answered with a server error; trying later may work. */
  UNAVAILABLE: "unavailable",
  /** The reply window has closed (WhatsApp 24 hours; Instagram after 7 days). */
  WINDOW_CLOSED: "window_closed",
  /** The person cannot receive this message (not on WhatsApp, blocked us, unsupported). */
  UNDELIVERABLE: "undeliverable",
  /** The platform refused the content or a parameter; the same call fails the same way. */
  REFUSED: "refused",
  /** The request may have taken effect but we never heard back (ADR-0086). */
  UNCERTAIN: "uncertain",
} as const;
export type SocialError = (typeof SOCIAL_ERROR)[keyof typeof SOCIAL_ERROR];
