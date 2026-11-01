import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductsView } from "@/components/product/console/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { orgChannelReadinessDAL } from "@/data-access-layer/org/channel-readiness.dal";
import { ListingReadinessPanel } from "@/components/channel/listing-readiness-panel";
import { channelListingsDAL } from "@/data-access-layer/channel-listings.dal";
import { ProductMarketplaces } from "@/components/channel/product-marketplaces";
import { MarketplaceFactsCard } from "@/components/channel/marketplace-facts-card";
import { TeamEditBadge } from "@/components/product/team/team-edit-badge";
import { TeamHistory, TeamHistorySkeleton, type TeamHistoryRead } from "@/components/product/team/team-history";
import { TEAM_HISTORY_ANCHOR } from "@/components/product/team/team-edit-copy";
import { productTeamDAL } from "@/data-access-layer/org/product-team.dal";

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
  const [verdicts, marketplaces, facts] = await Promise.all([
    orgChannelReadinessDAL.forProduct(orgId, {
      productType: product.productType ?? null,
      kind: product.kind ?? null,
      facts: product.facts,
    }),
    channelListingsDAL.forProduct(orgId, id),
    channelListingsDAL.factsForProduct(orgId, id),
  ]);

  return (
    <Suspense>
      <div className="space-y-6">
        {/* The team's mark stays until the shop next saves this product (product-form R12, Q14). */}
        {product.teamEditedAt && <TeamEditBadge at={product.teamEditedAt} historyHref={`#${TEAM_HISTORY_ANCHOR}`} />}
        <ProductsView
          help="products"
          product={product}
          category={product.category}
          org={product.org}
        />
        <ProductMarketplaces orgId={orgId} links={marketplaces} />
        {facts.map((card) => (
          <MarketplaceFactsCard key={card.listingId} orgId={orgId} productId={id} shopName={product.org.name} card={card} />
        ))}
        <ListingReadinessPanel verdicts={verdicts} />
        <Suspense fallback={<TeamHistorySkeleton />}>
          <TeamHistoryData productId={id} orgId={orgId} />
        </Suspense>
      </div>
    </Suspense>
  );
}

/** The history reads on its own and fails alone, with its own retry (ux "Couldn't load the history."). */
async function TeamHistoryData({ productId, orgId }: { productId: string; orgId: string }) {
  let read: TeamHistoryRead;
  try {
    read = { ok: true, edits: await productTeamDAL.history(productId, orgId) };
  } catch (error) {
    console.error("[product] team history read failed", { productId, error });
    read = { ok: false };
  }
  return <TeamHistory read={read} />;
}
