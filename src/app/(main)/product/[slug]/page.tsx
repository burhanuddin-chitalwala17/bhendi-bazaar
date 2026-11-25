import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductDetails } from "@/components/product/product-details";
import { ProductBuyActions } from "@/components/product/product-buy-actions";
import { ActionBar } from "@/components/shared/action-bar";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { Reviews } from "@/components/product/reviews";
import { SimilarProducts } from "@/components/product/similar-products";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontAccessDAL } from "@/data-access-layer/storefront-access.dal";
import { productChromeShop } from "@/data-access-layer/storefront.dal";
import { Suspense, cache } from "react";
import { ProductPageSkeleton } from "@/components/shared/states/LoadingSkeleton";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { appUrl } from "@server/shared/app-url";
import { NotFoundError } from "@server/shared/domain-error";
import { JsonLd } from "@/components/shared/JsonLd";
import { productJsonLd } from "@/lib/structured-data";
import { PRODUCT_PAGE_COPY } from "./product-page-copy";
import { ROUTES } from "@server/shared/routes";
import { ExpiredLinkLine } from "@/components/cart/checkout-link/ExpiredLinkLine";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page each need the product; cache() makes that one query.
const getProduct = cache((slug: string) => productsDAL.getProductBySlug(slug));

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    // A dead slug is a 404 here too: metadata resolves first, and swallowing it was a soft 404.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const url = `${appUrl()}${ROUTES.product(product.slug)}`;
  // The layout's template adds the brand; the social card states it in full.
  const title = product.name;
  const socialTitle = `${product.name} — ${APP_NAME}`;
  const description = product.description?.trim().slice(0, 200) || APP_NAME;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      title: socialTitle,
      description,
      // No declared width/height: nothing stores the cover's pixel size, and a guessed
      // ratio is what makes a scraper crop the card wrong. The cover is a Blob raster —
      // scrapers ignore the site-wide `OG_IMAGE`, which is an SVG none of them read.
      images: [{ url: product.thumbnail, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [product.thumbnail],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const [orgStorefrontOpen, chromeShop] = await Promise.all([
    storefrontAccessDAL.isOpen(product.org.id),
    productChromeShop(),
  ]);
  const shopHandle = chromeShop?.handle ?? null;
  return (
    <div className="space-y-8 md:space-y-12">
      {/* Reads the query on the client, so the page itself stays as cacheable as it was. */}
      <Suspense fallback={null}>
        <ExpiredLinkLine />
      </Suspense>
      {(() => {
        const ld = productJsonLd(appUrl(), product);
        return ld ? <JsonLd data={ld} /> : null;
      })()}
      <Suspense fallback={<ProductPageSkeleton />}>
        {/* Photo and words share the width, as StorePDPDesktop draws them: a 3:2 photo column made the picture taller than the screen. */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:gap-12">
          <ProductGallery {...product} />
          <ProductDetails {...product} orgStorefrontOpen={orgStorefrontOpen} shopHandle={shopHandle} />
        </div>
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <Reviews product={product} />
      </Suspense>
      {/* Streamed: the product renders without waiting for its neighbours (B12). */}
      <Suspense fallback={<LoadingSkeleton />}>
        <SimilarFor slug={slug} shop={chromeShop ? { id: chromeShop.id, handle: chromeShop.handle } : null} />
      </Suspense>
      {/* The phone's docked price and Add to bag, above the tab bar; inline in the details from a tablet up. */}
      <ActionBar className="-mx-3 sm:-mx-6 md:hidden" status={<DockedPrice price={product.price} salePrice={product.salePrice} />}>
        <ProductBuyActions product={product} className="min-w-40" />
      </ActionBar>
    </div>
  );
}

async function SimilarFor({ slug, shop }: { slug: string; shop: { id: string; handle: string } | null }) {
  // A side section: if it cannot load, it is left out rather than replacing the product with an error.
  const products = await (shop ? productsDAL.getSimilarProductsForOrg(slug, shop.id, 4) : productsDAL.getSimilarProducts(slug, 4)).catch(
    (error: unknown) => {
      console.error("[product] similar products unavailable:", error);
      return [];
    },
  );
  // Inside a shop, only that shop's goods, and each keeps the buyer in the shop (storefront-themes Q33).
  return <SimilarProducts products={products} shopHandle={shop?.handle ?? null} />;
}

function DockedPrice({ price, salePrice }: { price: number; salePrice?: number }) {
  return (
    <span className="flex flex-col">
      <PriceDisplay price={price} salePrice={salePrice} size="md" showBadge={false} />
      <span className="text-caption text-muted-foreground">{PRODUCT_PAGE_COPY.inclusiveOfTaxes}</span>
    </span>
  );
}
