import type { Metadata } from "next";
import { Tag } from "lucide-react";

import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { productsDAL } from "@/data-access-layer/products.dal";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: "Offers",
  description: "Everything reduced right now on Bhendi Bazaar.",
  alternates: { canonical: `${appUrl()}/offers` },
};

/**
 * Everything on offer across the marketplace.
 *
 * Where the strip's "View more" lands. Prices resolve through the one function every
 * other surface uses, and `offerOnly` is the same coverage query the strip itself
 * runs (ADR-0018) — so this page and the strip above it cannot disagree about what is
 * reduced, which is the failure mode a separate "sale" list would have.
 */
export default async function OffersPage() {
  const page = await productsDAL.getPage({ offerOnly: true });

  return (
    <div className="space-y-6">
      <SectionHeader
        overline="Ongoing offers"
        title="Everything reduced right now"
      />

      {page.products.length > 0 ? (
        <PaginatedProductGrid
          initial={page.products}
          initiallyDone={page.done}
          query={{ offersOnly: true }}
          emptyLabel="offers"
        />
      ) : (
        <EmptyState
          icon={Tag}
          title="No offers running"
          description="Nothing is reduced at the moment. Check back soon."
        />
      )}
    </div>
  );
}
