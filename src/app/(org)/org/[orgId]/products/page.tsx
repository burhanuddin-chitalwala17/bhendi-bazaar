import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { orgChannelSummaryDAL } from "@/data-access-layer/org/channel-summary.dal";
import { ChannelReadinessSummary } from "@/components/channel/channel-readiness-summary";
import { ProductsContainer } from "@/components/product/console/productsList";
import { ProductsTableSkeleton } from "@/components/product/console/productsList/components/ProductsTableSkeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { orgAddressService } from "@server/catalog/org.address.service";
import { channelConnectionService } from "@server/channels/channel-connection.service";
import { CARD_STATE, isMarketplaceChannel } from "@server/channels/channel-connection.types";
import type { BulkMarketplace } from "@/components/product/console/bulk/BulkActionDialog";
import type { ProductShelf } from "@server/catalog/product.visibility";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { PageHeader } from "@/components/shared/page-shell";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    category?: string;
    sort?: string;
    order?: "asc" | "desc";
    lowStock?: string;
    outOfStock?: string;
    shelf?: string;
    wishlisted?: string;
  }>;
}

/**
 * A query string is caller-controlled, so the shelf is matched against the closed set
 * rather than cast into it — an unknown value falls back to available (Invariant 4).
 */
const SHELVES: ProductShelf[] = ["available", "archived", "all"];
const shelfFrom = (value: string | undefined): ProductShelf =>
  SHELVES.find((shelf) => shelf === value) ?? "available";

export default async function OrgProductsPage({
  params,
  searchParams,
}: PageProps) {
  const { orgId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        help="products"
        title="Products"
        description="Add and edit what you sell"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/org/${orgId}/products/bulk`} prefetch={false}>
                <Icon name="upload" size="sm" />
                Add many at once
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/org/${orgId}/products/new`} prefetch={false}>
                <Icon name="add" size="sm" />
                Add a product
              </Link>
            </Button>
          </>
        }
      />

      <Suspense fallback={<ProductsTableSkeleton />}>
        <OrgProductsData orgId={orgId} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrgProductsData({
  orgId,
  searchParams,
}: {
  orgId: string;
  searchParams: PageProps["searchParams"];
}) {
  const params = await searchParams;

  // `orgId` comes from the path, never the query string — a filter the caller controls
  // could otherwise widen this to another org's catalogue.
  const filters = {
    orgId,
    page: resolvePageNumber(params.page),
    limit: resolvePageSize(params.limit),
    search: params.search,
    categoryId: params.category,
    sortBy: params.sort as "name" | "createdAt" | "price" | "stock" | undefined,
    sortOrder: params.order,
    lowStock: params.lowStock === "true" ? true : undefined,
    outOfStock: params.outOfStock === "true" ? true : undefined,
    shelf: shelfFrom(params.shelf),
    wishlistedOnly: params.wishlisted === "true" ? true : undefined,
  };

  const [productsData, stats, categoryList, channels, locations, connections] = await Promise.all([
    adminProductsDAL.getProducts(filters),
    adminProductsDAL.getStats(orgId),
    adminCategoriesDAL.getCategories(),
    // Empty, and so silent, for a shop that sells nowhere else — which is most of them.
    orgChannelSummaryDAL.forOrg(orgId),
    orgAddressService.listLocations(orgId),
    channelConnectionService.overview(orgId),
  ]);
  // Only a marketplace that will take a send right now; the rest are Channels' to fix.
  const marketplaces: BulkMarketplace[] = connections.cards.flatMap((card) =>
    isMarketplaceChannel(card.channel) && (card.state === CARD_STATE.CONNECTED || card.state === CARD_STATE.RENEWAL_DUE)
      ? [{ channel: card.channel, label: card.label }]
      : [],
  );

  return (
    <div className="space-y-4">
      <ChannelReadinessSummary orgId={orgId} rows={channels} />
      <ProductsContainer
        initialData={productsData}
        initialStats={stats}
        initialFilters={filters}
        categories={categoryList.categories}
        locations={locations.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name }))}
        marketplaces={marketplaces}
        addHref={`/org/${orgId}/products/new`}
      />
    </div>
  );
}
