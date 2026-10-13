/**
 * A shopfront channel's feed, assembled ([shopfront-feeds](../../docs/specs/shopfront-feeds/)).
 *
 * Products come from the read the product page uses, so the declared price and availability are
 * that page's answers, not a second computation of them (spec R2, R3; D2).
 */

import { appUrl } from "@server/shared/app-url";
import {
  buildFeed,
  categoryFor,
  isBuyable,
  type FeedCandidate,
  type ShopfrontChannel,
} from "@server/listing/shopfront-feed";
import { shopfrontFeedService } from "@server/listing/shopfront-feed.service";
import { productsDAL, type ChannelFeedProduct } from "@/data-access-layer/products.dal";
import { effectivePrice, hasOffer } from "@/domain/product";
import { APP_NAME } from "@/lib/config";
import { crawlersBlocked } from "@/lib/crawl-block";

/** A root-relative ref made absolute on our origin; anything that is not a fetchable URL is dropped. */
function absolute(ref: string, origin: string): string | null {
  if (ref.startsWith("/")) return `${origin}${ref}`;
  return /^https?:\/\//.test(ref) ? ref : null;
}

function toCandidate(
  { product, brandName }: ChannelFeedProduct,
  category: string | null,
  origin: string,
): FeedCandidate {
  const photos = product.media.filter((m) => m.kind === "IMAGE");
  const ordered = [...photos.filter((m) => m.isThumbnail), ...photos.filter((m) => !m.isThumbnail)];
  return {
    id: product.id,
    title: product.name,
    description: product.description,
    link: `${origin}/product/${product.slug}`,
    images: ordered.map((m) => absolute(m.ref, origin)).filter((url) => url !== null),
    pricePaise: product.price,
    // The rule the product page shows offers by, so a zero or inverted sale price is never declared (D5).
    offerPricePaise: hasOffer(product) ? effectivePrice(product) : null,
    inStock: isBuyable(product),
    // The shop is the maker of what it sells unbranded (D9).
    brand: brandName ?? product.org.name,
    category,
  };
}

export async function shopfrontFeedXml(channel: ShopfrontChannel): Promise<string> {
  const origin = appUrl();
  const header = { title: APP_NAME, link: origin };
  // Pre-launch, as the sitemap does: a valid feed with nothing in it (D11).
  if (crawlersBlocked()) return buildFeed(channel, header, []);

  const orgIds = await shopfrontFeedService.orgsSellingOn(channel);
  if (orgIds.length === 0) return buildFeed(channel, header, []);

  const [products, rules] = await Promise.all([
    productsDAL.listForChannelFeed(orgIds),
    shopfrontFeedService.categoryRules(channel),
  ]);

  const candidates = products.flatMap((row) => {
    const verdict = categoryFor(rules, row.productType, row.kind);
    return verdict.sold ? [toCandidate(row, verdict.category, origin)] : [];
  });
  return buildFeed(channel, header, candidates);
}
