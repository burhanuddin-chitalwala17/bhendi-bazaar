import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductDetails } from "@/components/product/product-details";
import { Reviews } from "@/components/product/reviews";
import { SimilarProducts } from "@/components/product/similar-products";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { productsDAL } from "@/data-access-layer/products.dal";
import { Suspense, cache } from "react";
import { ProductPageSkeleton } from "@/components/shared/states/LoadingSkeleton";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { appUrl } from "@server/shared/app-url";
import { NotFoundError } from "@server/shared/domain-error";
import { JsonLd } from "@/components/shared/JsonLd";
import { productJsonLd } from "@/lib/structured-data";

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

  const url = `${appUrl()}/product/${product.slug}`;
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
  return (
    // pb-16 clears the docked Add-to-cart bar, which is fixed and so out of flow.
    <div className="space-y-6 pb-16 sm:space-y-8 md:pb-0">
      {(() => {
        const ld = productJsonLd(appUrl(), product);
        return ld ? <JsonLd data={ld} /> : null;
      })()}
      <Suspense fallback={<ProductPageSkeleton />}>
        <div className="grid gap-4 sm:gap-8 lg:grid-cols-2">
          <ProductGallery {...product} />
          <ProductDetails {...product} />
        </div>
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <Reviews product={product} />
      </Suspense>
      {/* Streamed: the product renders without waiting for its neighbours (B12). */}
      <Suspense fallback={<LoadingSkeleton />}>
        <SimilarFor slug={slug} />
      </Suspense>
    </div>
  );
}

async function SimilarFor({ slug }: { slug: string }) {
  // A side section: if it cannot load, it is left out rather than replacing the product with an error.
  const products = await productsDAL.getSimilarProducts(slug, 4).catch((error: unknown) => {
    console.error("[product] similar products unavailable:", error);
    return [];
  });
  return <SimilarProducts products={products} />;
}
