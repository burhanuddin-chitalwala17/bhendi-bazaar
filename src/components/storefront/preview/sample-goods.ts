import type { Product } from "@/domain/product";
import type { ThemedPageData } from "../themed/page-data";

/** ux.md picker, Empty: the label over a preview drawn with sample goods. */
export const SAMPLE_GOODS_NOTE = "Showing sample products until you add your own.";

/** Paise, as every price is (Invariant 3); sample only, never sold. */
const SAMPLES: ReadonlyArray<{ name: string; price: number; salePrice?: number }> = [
  { name: "Sample product 1", price: 149_900 },
  { name: "Sample product 2", price: 89_900, salePrice: 69_900 },
  { name: "Sample product 3", price: 249_900 },
  { name: "Sample product 4", price: 49_900 },
  { name: "Sample product 5", price: 129_900 },
  { name: "Sample product 6", price: 79_900 },
];

/**
 * An empty shop previews labelled sample goods declared here (storefront-themes D12), so the
 * owner judges a theme by a page with goods on it. No photo: each card draws the theme's
 * pattern (Q17). Only the preview ever reads these; no buyer page does.
 */
export function sampleGoods(shop: { id: string; name: string; handle: string }): Product[] {
  return SAMPLES.map((sample, index) => ({
    id: `sample-${index + 1}`,
    slug: `sample-${index + 1}`,
    name: sample.name,
    description: "",
    price: sample.price,
    salePrice: sample.salePrice,
    currency: "INR",
    categorySlug: "",
    tags: [],
    rating: 0,
    reviewsCount: 0,
    media: [],
    thumbnail: "",
    weight: 0,
    stock: 1,
    lowStockThreshold: 0,
    shippingFromPincode: "",
    org: { id: shop.id, name: shop.name, code: "", handle: shop.handle },
  }));
}

/** The page with sample goods in every shelf, when the shop has none of its own. */
export function withSampleGoods(page: ThemedPageData, shop: { id: string }): ThemedPageData {
  if (page.productCount > 0) return page;
  const goods = sampleGoods({ id: shop.id, name: page.name, handle: page.handle });
  return { ...page, productCount: goods.length, bestSelling: goods, newIn: goods, dealProducts: goods.filter((g) => g.salePrice) };
}
