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

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// generateMetadata and the page each need the product; cache() makes that one query.
const getProduct = cache((slug: string) => productsDAL.getProductBySlug(slug));

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;

  let product;
  try {
    product = await getProduct(slug);
  } catch {
    // A crawler asking for a dead slug gets the site card, not a build error.
    return {};
  }

  const url = `${appUrl()}/product/${product.slug}`;
  const title = `${product.name} — ${APP_NAME}`;
  const description = product.description?.trim().slice(0, 200) || APP_NAME;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      title,
      description,
      // No declared width/height: nothing stores the cover's pixel size, and a guessed
      // ratio is what makes a scraper crop the card wrong. The cover is a Blob raster —
      // scrapers ignore the site-wide `OG_IMAGE`, which is an SVG none of them read.
      images: [{ url: product.thumbnail, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.thumbnail],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await getProduct(slug);
  const similar = await productsDAL.getSimilarProducts(slug, 4);
  return (
    // pb-16 clears the docked Add-to-cart bar, which is fixed and so out of flow.
    <div className="space-y-6 pb-16 sm:space-y-8 md:pb-0">
      <Suspense fallback={<ProductPageSkeleton />}>
        <div className="grid gap-4 sm:gap-8 lg:grid-cols-2">
          <ProductGallery {...product} />
          <ProductDetails {...product} />
        </div>
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <Reviews product={product} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <SimilarProducts products={similar} />
      </Suspense>
    </div>
  );
}
