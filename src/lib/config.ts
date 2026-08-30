export const APP_NAME = "Bhendi Bazaar";
export const APP_DESCRIPTION = "Bhendi Bazaar – a royal curation of Islamic clothing, boutique wear, and essentials.";
export const APP_TAGLINE = "Shop from the Caravan.";
export const APP_SUPPORT_EMAIL = "support@bhendibazaar.com";
export const LOGO = {
    FULL: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    ICON: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    LIGHT: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    DARK: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    TEXT: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    192: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
    512: "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg",
}
export const FAVICON = "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/bhendi-bazaar.svg";
/**
 * Deliberately a PNG at the 1.91:1 the scrapers want, not `LOGO` — WhatsApp, Facebook
 * and Slack render no SVG at all, which is why a shared link used to arrive pictureless.
 */
export const OG_IMAGE = "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/logos/og-image.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
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
