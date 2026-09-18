export const APP_NAME = "Bhendi Bazaar";
export const APP_DESCRIPTION = "Bhendi Bazaar – a royal curation of Islamic clothing, boutique wear, and essentials.";
export const APP_TAGLINE = "Shop from the Caravan.";
export const APP_SUPPORT_EMAIL = "support@bhendibazaar.com";
/**
 * The number Contact us opens a conversation on (docs/specs/contact-us/ R3).
 *
 * `digits` is E.164 without the `+`, which is what a `wa.me` path accepts; `display` is
 * for a person to read. A static, public brand fact, so it belongs here rather than in
 * an environment variable. Build the link with `whatsappSupportUrl` — never by
 * concatenating a wa.me string at a call site.
 */
export const SUPPORT_WHATSAPP = {
  digits: "918452959340",
  display: "+91 84529 59340",
} as const;

/** The opening line a buyer arrives in WhatsApp with, theirs to edit before sending. */
export const SUPPORT_WHATSAPP_MESSAGE = `Hello ${APP_NAME}, I need some help.`;
/**
 * Brand assets ship with the app, in `public/brand/` — they are not user content.
 *
 * These pointed at the object store until ADR-0028, which made the site's own logo and
 * favicon disappear the moment that store was blocked, with nothing in the database to
 * repoint. A logo belongs in the repository: it changes on a rebrand, not on an upload,
 * it is served free from the CDN, it needs no optimizer, and it cannot be broken by a
 * storage provider. Root-relative because `metadataBase` in app/layout.tsx makes these
 * absolute where a scraper needs them — the origin is never a constant here.
 */
export const LOGO = {
  FULL: "/brand/bhendi-bazaar.png",
  ICON: "/brand/bhendi-bazaar.png",
  LIGHT: "/brand/bhendi-bazaar.png",
  DARK: "/brand/bhendi-bazaar.png",
  TEXT: "/brand/bhendi-bazaar.png",
  192: "/brand/bhendi-bazaar.png",
  512: "/brand/bhendi-bazaar.png",
}
export const FAVICON = "/brand/bhendi-bazaar.png";
/**
 * A raster, not `LOGO` — WhatsApp, Facebook and Slack render no SVG at all, which is
 * why a shared link used to arrive pictureless.
 *
 * The size is the file's real one, measured, not the 1.91:1 the platforms prefer: a
 * declared size that disagrees with the bytes is what makes a scraper crop the card
 * wrong, so an honest 3:2 beats an aspirational 1.91:1. Re-cut the artwork to 1200x630
 * and update both together if the cropping ever looks wrong in a share.
 */
export const OG_IMAGE = "/brand/og-image.jpeg";
export const OG_IMAGE_SIZE = { width: 1536, height: 1024 } as const;
/**
 * What a hero banner image has to be. One constant, read by the field label, the file
 * picker's check and the docs, so the size an admin is told cannot drift from the size
 * that is enforced.
 *
 * 5:2 because the banner is a fixed box (h-60 → lg:h-96) that is far wider than tall on
 * every breakpoint, and 1600px wide covers the 1152px column on a 2× display. The left
 * third carries the words, so the subject belongs right of centre.
 */
const BANNER_IMAGE_WIDTH = 1600;
const BANNER_IMAGE_HEIGHT = 640;

export const BANNER_IMAGE = {
  width: BANNER_IMAGE_WIDTH,
  height: BANNER_IMAGE_HEIGHT,
  /** Derived, never restated — a hand-written 2.5 beside the dimensions is one
   *  edit away from disagreeing with them. `--aspect-banner-source` carries the same
   *  shape to CSS, and `tests/unit/home-banners.test.ts` holds the two together. */
  ratio: BANNER_IMAGE_WIDTH / BANNER_IMAGE_HEIGHT,
  /** How far from that shape a file may be before it is refused. */
  ratioTolerance: 0.25,
} as const;
