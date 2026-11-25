/** Captions drafted from a post's products (ai-images/social-posts D3, D4; Q47). */

export const CAPTION_LANGUAGE = { EN: "en", HI: "hi", BOTH: "both" } as const;
export type CaptionLanguage = (typeof CAPTION_LANGUAGE)[keyof typeof CAPTION_LANGUAGE];
export const CAPTION_LANGUAGES = Object.values(CAPTION_LANGUAGE) as [CaptionLanguage, ...CaptionLanguage[]];

/** Well inside Instagram's 2,200 characters and 30 hashtags (ux.md, Long content). */
export const CAPTION_MAX_CHARS = 600;
export const CAPTION_MAX_HASHTAGS = 8;

/** One product as the caption may speak of it: the live facts, never the shop's typing. */
export interface CaptionProductFacts {
  productId: string;
  name: string;
  /** `Product.price`, the list price. */
  pricePaise: number;
  /** The promotions resolver's price when an offer lowers it; null without one. */
  offerPricePaise: number | null;
  offerLabel: string | null;
  category: string | null;
  material: string | null;
}

export interface CaptionFacts {
  shopName: string;
  language: CaptionLanguage;
  products: CaptionProductFacts[];
}

/** Where a drafted caption came from: the model, or the template when no model gave a true one. */
export const CAPTION_SOURCE = { MODEL: "model", TEMPLATE: "template" } as const;
export type CaptionSource = (typeof CAPTION_SOURCE)[keyof typeof CAPTION_SOURCE];

export interface CaptionDraftDto {
  caption: string;
  source: CaptionSource;
  language: CaptionLanguage;
}

/** A price the caption was drafted with that the product no longer has (journey 5). */
export interface CaptionPriceChangeDto {
  productId: string;
  wasPaise: number;
  nowPaise: number;
  /** False when swapping the number would still leave a false claim; the shop writes the caption again. */
  rewritable: boolean;
}

export const CAPTION_COPY = {
  needsProduct: "Add a product first, so the caption can say what it is.",
  writeAgain: "The offer in your caption has changed. Write the caption again.",
  /** The template's own words (D3), used when no model wrote a caption that passed the check. */
  template: {
    en: { now: "now", was: "was", from: (shop: string) => `From ${shop}.` },
    hi: { now: "अब", was: "पहले", from: (shop: string) => `${shop} पर उपलब्ध।` },
  },
} as const;
