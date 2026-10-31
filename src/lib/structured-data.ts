// schema.org JSON-LD for search results (docs/GTM-READINESS.md B10). Pure builders, so a test can
// read exactly what Google will; prices come from the same resolver that charges (ADR-0018).
import { APP_DESCRIPTION, APP_NAME, LOGO } from "@/lib/config";
import { paiseToDecimal } from "@/lib/format";
import type { Product } from "@/domain/product";
import type { MediaKind } from "@server/catalog/media";

type Json = Record<string, unknown>;

/** Escapes `<`, so a product name can never close the script tag it sits in. */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const absolute = (origin: string, url: string) => (url.startsWith("http") ? url : `${origin}${url}`);

export function organizationJsonLd(origin: string, sameAs: readonly string[] = []): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: origin,
    logo: absolute(origin, LOGO["512"]),
    description: APP_DESCRIPTION,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(origin: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: origin,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/s?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(origin: string, trail: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(origin, item.path),
    })),
  };
}

export function productJsonLd(origin: string, product: Product): Json {
  const url = `${origin}/product/${product.slug}`;
  // What the buyer pays now: the offer price when one applies, else the list price.
  const pricePaise = product.salePrice ?? product.price;
  // Up for bidding is not for sale here (ADR-0023), whatever the stock says.
  const buyable = product.stock > 0 && !product.biddingSlug;
  const images = product.media?.filter((m) => m.kind === ("IMAGE" satisfies MediaKind)).map((m) => absolute(origin, m.ref)) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    image: images.length ? images : [absolute(origin, product.thumbnail)],
    ...(product.description?.trim() ? { description: product.description.trim().slice(0, 5000) } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: paiseToDecimal(pricePaise),
      priceCurrency: product.currency || "INR",
      availability: buyable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: product.org.name },
    },
  };
}
