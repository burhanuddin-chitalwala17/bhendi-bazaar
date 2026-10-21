import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductsView } from "@/components/product/console/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { orgChannelReadinessDAL } from "@/data-access-layer/org/channel-readiness.dal";
import { ListingReadinessPanel } from "@/components/channel/listing-readiness-panel";
import { channelListingsDAL } from "@/data-access-layer/channel-listings.dal";
import { ProductMarketplaces } from "@/components/channel/product-marketplaces";

export default async function OrgProductViewPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const product = await adminProductsDAL.getProductById(id);

  // A product id in the path is the caller's to choose. Not-found rather than forbidden:
  // whether another org owns this id is not this caller's business.
  if (!product || product.org.id !== orgId) notFound();

  // Silent for a shop that sells nowhere else, which is most of them until they say otherwise.
  const [verdicts, marketplaces] = await Promise.all([
    orgChannelReadinessDAL.forProduct(orgId, {
      productType: product.productType ?? null,
      kind: product.kind ?? null,
      facts: product.facts,
    }),
    channelListingsDAL.forProduct(orgId, id),
  ]);

  return (
    <Suspense>
      <div className="space-y-6">
        <ProductsView
          product={product}
          category={product.category}
          org={product.org}
        />
        <ProductMarketplaces orgId={orgId} links={marketplaces} />
        <ListingReadinessPanel verdicts={verdicts} />
      </div>
    </Suspense>
  );
}
