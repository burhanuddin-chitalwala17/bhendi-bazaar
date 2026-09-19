import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StorefrontIdentity } from "@/components/storefront/storefront-identity";
import type { Storefront } from "@/data-access-layer/storefront.dal";

/**
 * The storefront's masthead: who the shop is, and the way to read about it.
 *
 * No cover image here. The cover used to sit above this and was the first thing a
 * shared link showed, which spent the top of a phone screen on a picture rather than
 * on what the shop is running right now. The promotions took that slot; the cover
 * moved to the about page, where a visitor has already chosen to read about the shop
 * and a large picture is what they came for (decided 2026-09-19).
 */
export function StorefrontHero({ shop }: { shop: Storefront }) {
  return (
    <header className="space-y-4">
      <StorefrontIdentity shop={shop} />

      {/* The about page is what makes a stranger willing to pay, so it is one tap from
          the top of the shop rather than buried under the grid. */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/store/${shop.handle}/about`}>About this shop</Link>
        </Button>
      </div>
    </header>
  );
}
