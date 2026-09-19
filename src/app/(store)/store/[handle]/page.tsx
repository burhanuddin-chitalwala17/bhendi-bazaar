import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";

import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Button } from "@/components/ui/button";
import { StorefrontHero } from "@/components/storefront/storefront-hero";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { appUrl } from "@server/shared/app-url";
import { resolveStorefront } from "./resolve";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
}

/**
 * The shop names itself, not the platform (storefront-discovery R1).
 *
 * `getByHandle` is request-memoised, so this costs nothing beyond the page's own read
 * — Next calls metadata and the page separately and would otherwise ask twice.
 */
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  if (!shop) return {};

  const description =
    shop.tagline ??
    shop.about?.slice(0, 160) ??
    `Shop ${shop.name} on Bhendi Bazaar.`;
  const url = `${appUrl()}/store/${shop.handle}`;

  return {
    title: shop.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: shop.name,
      description,
      url,
      ...(shop.heroUrl || shop.logoUrl
        ? {
            images: [
              { url: (shop.heroUrl ?? shop.logoUrl) as string, alt: shop.name },
            ],
          }
        : {}),
    },
  };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { handle } = await params;
  const shop = await resolveStorefront(handle);

  // Scoped by id, resolved here from the handle — the client never supplies an org
  // (ADR-0030 decision 6). Prices resolve through the one function the rest of the
  // store uses, so a storefront cannot advertise a price checkout would refuse.
  const products = await productsDAL.getProducts({ orgId: shop.id });

  return (
    <div className="space-y-8">
      <StorefrontHero shop={shop} />

      {products.length > 0 ? (
        <section className="space-y-4">
          <SectionHeader
            overline="The shop"
            title={`Everything from ${shop.name}`}
          />
          <ProductGrid products={products} />
        </section>
      ) : (
        <EmptyState
          icon={Package}
          title="Nothing here just yet"
          description={`${shop.name} has not listed anything for sale. Come back soon.`}
        />
      )}

      {/* R11: a visitor is never trapped in one shop. */}
      <div className="flex justify-center pt-2">
        <Button asChild variant="outline">
          <Link href="/">Browse the whole marketplace</Link>
        </Button>
      </div>
    </div>
  );
}
