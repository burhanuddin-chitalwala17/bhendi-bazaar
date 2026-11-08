import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductsView } from "@/components/product/console/ProductsView";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { orgChannelReadinessDAL } from "@/data-access-layer/org/channel-readiness.dal";
import { ListingReadinessPanel } from "@/components/channel/listing-readiness-panel";
import { channelListingsDAL } from "@/data-access-layer/channel-listings.dal";
import { ProductMarketplaces } from "@/components/channel/product-marketplaces";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { MarketplaceFactsCard } from "@/components/channel/marketplace-facts-card";
import { TeamEditBadge } from "@/components/product/team/team-edit-badge";
import { TeamHistory, TeamHistorySkeleton, type TeamHistoryRead } from "@/components/product/team/team-history";
import { TEAM_HISTORY_ANCHOR } from "@/components/product/team/team-edit-copy";
import { productTeamDAL } from "@/data-access-layer/org/product-team.dal";
import { reviewsDAL } from "@/data-access-layer/reviews.dal";
import { ProductReviewsSection, ProductReviewsSkeleton, type ProductReviewsRead } from "@/components/org/product-reviews-section";
import { ROUTES } from "@server/shared/routes";
import { ChannelCompletenessStrip } from "@/components/channel/channel-completeness-strip";
import { productCompletenessDAL } from "@/data-access-layer/org/product-completeness.dal";

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
  const [verdicts, marketplaces, facts, summaries, completeness] = await Promise.all([
    orgChannelReadinessDAL.forProduct(orgId, {
      productType: product.productType ?? null,
      kind: product.kind ?? null,
      facts: product.facts,
    }),
    channelListingsDAL.forProduct(orgId, id),
    channelListingsDAL.factsForProduct(orgId, id),
    platformListingDAL.summaries(orgId, id),
    productCompletenessDAL.forProduct(id),
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
        {/* What each channel the shop sells on still needs, as last computed (dynamic-form R4, Q2). */}
        <ChannelCompletenessStrip states={completeness} />
        <ProductMarketplaces orgId={orgId} productId={id} links={marketplaces} summaries={summaries} />
        {facts.map((card) => (
          <MarketplaceFactsCard key={card.listingId} orgId={orgId} productId={id} shopName={product.org.name} card={card} />
        ))}
        <ListingReadinessPanel verdicts={verdicts} />
        <Suspense fallback={<ProductReviewsSkeleton />}>
          <ProductReviewsData productId={id} orgId={orgId} />
        </Suspense>
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

/** Reviews read beside what they are about (own-store onboarding D12), and fail alone. */
async function ProductReviewsData({ productId, orgId }: { productId: string; orgId: string }) {
  let read: ProductReviewsRead;
  try {
    read = { ok: true, page: await reviewsDAL.firstPage(productId) };
  } catch (error) {
    console.error("[product] reviews read failed", { productId, error });
    read = { ok: false };
  }
  return <ProductReviewsSection read={read} allReviewsHref={ROUTES.org.reviews(orgId)} />;
}
