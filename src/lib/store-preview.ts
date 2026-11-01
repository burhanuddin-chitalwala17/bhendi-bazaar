/**
 * What a chat app shows when a shop's link is pasted: the store page's Open Graph card. The store
 * page's metadata and the share sheet's preview both read it here, so the sheet cannot promise a
 * card the link does not produce (own-store onboarding D13).
 */
export interface StorePreview {
  title: string;
  description: string;
  image: string | null;
}

export interface StorePreviewSource {
  name: string;
  tagline: string | null;
  about: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
}

export function storePreview(shop: StorePreviewSource): StorePreview {
  return {
    title: shop.name,
    description: shop.tagline ?? shop.about?.slice(0, 160) ?? `Shop ${shop.name} on Bhendi Bazaar.`,
    image: shop.heroUrl ?? shop.logoUrl ?? null,
  };
}

/** Everything the share sheet needs about one shop. */
export interface ShareShop {
  name: string;
  /** `/store/{handle}`, for "See as a buyer". */
  path: string;
  /** The full link sent on WhatsApp and copied. */
  url: string;
  preview: StorePreview;
}
