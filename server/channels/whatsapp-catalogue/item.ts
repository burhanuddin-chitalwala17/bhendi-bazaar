import { isAiMade } from "@server/content/enhancement.types";
import type { PricedProduct } from "@server/promotions/price-context";
import { canonicalJson, sha256Hex } from "@server/shared/hash";
import { feedPrice } from "@server/shared/money";
import { ROUTES } from "@server/shared/routes";
import { mainImageFirst } from "../listing-photos-out";
import { META_LIMITS } from "../providers/meta/meta-limits";

/** whatsapp-catalogue D1, D2. Pure: price (ADR-0018) and the buy button's stock answer are handed in. */

/** Why a product is not in the catalogue; the card counts each (spec R1, R8; ux copy deck). */
export const CATALOGUE_LEFT_OUT = {
  /** Not on the shop page; never shown to the shop, since not live means not in. */
  NOT_LIVE: "not_live",
  NO_PHOTO: "no_photo",
  AI_ONLY: "ai_only",
  NO_DESCRIPTION: "no_description",
} as const;
export type CatalogueLeftOut = (typeof CATALOGUE_LEFT_OUT)[keyof typeof CATALOGUE_LEFT_OUT];

export interface CatalogueProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  brand: string;
  /** On the shop's store page now. */
  live: boolean;
  /** The buy button's answer, an auction hold included (spec R3). */
  inStock: boolean;
  familyId: string | null;
  price: PricedProduct;
  /** Gallery order; each URL already in a format WhatsApp takes (D4). */
  photos: ReadonlyArray<{ url: string; asset: { transform?: unknown } | null }>;
}

/** The item as Meta's catalogue `items_batch` reads it; field names are Meta's. */
export interface CatalogueItem {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: string;
  sale_price?: string;
  link: string;
  image_link: string;
  additional_image_link: string[];
  brand: string;
  item_group_id?: string;
}

export type CatalogueVerdict =
  | { kind: "item"; item: CatalogueItem }
  | { kind: "left_out"; reason: CatalogueLeftOut };

/** By code point, so a cut never splits an emoji. */
const truncate = (text: string, max: number) => Array.from(text).slice(0, max).join("");

export function buildCatalogueItem(product: CatalogueProduct, origin: string): CatalogueVerdict {
  const leftOut = (reason: CatalogueLeftOut): CatalogueVerdict => ({ kind: "left_out", reason });
  if (!product.live) return leftOut(CATALOGUE_LEFT_OUT.NOT_LIVE);
  if (product.photos.length === 0) return leftOut(CATALOGUE_LEFT_OUT.NO_PHOTO);
  if (product.photos.every((photo) => isAiMade(photo.asset?.transform))) return leftOut(CATALOGUE_LEFT_OUT.AI_ONLY);
  const description = product.description.trim();
  if (description.length === 0) return leftOut(CATALOGUE_LEFT_OUT.NO_DESCRIPTION);

  const [main, ...more] = mainImageFirst(product.photos);
  if (!main) return leftOut(CATALOGUE_LEFT_OUT.NO_PHOTO);
  const { pricePaise, offerPricePaise, offerLabel } = product.price;
  return {
    kind: "item",
    item: {
      id: product.id,
      title: truncate(product.name, META_LIMITS.catalogueTitleChars.value),
      description: truncate(description, META_LIMITS.catalogueDescriptionChars.value),
      availability: product.inStock ? "in stock" : "out of stock",
      condition: "new",
      price: feedPrice(pricePaise),
      ...(offerLabel !== null ? { sale_price: feedPrice(offerPricePaise) } : {}),
      link: `${origin}${ROUTES.product(product.slug)}`,
      image_link: main.url,
      additional_image_link: more.slice(0, META_LIMITS.catalogueAdditionalImages.value).map((photo) => photo.url),
      brand: truncate(product.brand, META_LIMITS.catalogueBrandChars.value),
      ...(product.familyId !== null ? { item_group_id: product.familyId } : {}),
    },
  };
}

/** SHA-256 of the canonical item (D2): a sync sends an item only when this differs from what was sent. */
export function catalogueItemHash(item: CatalogueItem): string {
  return sha256Hex(new TextEncoder().encode(canonicalJson(item)));
}
