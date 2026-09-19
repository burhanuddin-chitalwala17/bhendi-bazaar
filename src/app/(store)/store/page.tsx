import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Store } from "lucide-react";

import { PageShell } from "@/components/shared/page-shell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: "Shops",
  description: "Every shop trading on Bhendi Bazaar.",
  alternates: { canonical: `${appUrl()}/store` },
};

/**
 * The directory (storefront-discovery R5).
 *
 * The one way to reach a shop whose name you do not already know — every other channel
 * needs the handle or a product to arrive from. A shop with nothing on sale is omitted:
 * the directory exists so a stranger finds somewhere to buy, and an empty shop is a
 * dead end. Its own URL still works, so nothing an org shared is broken by that.
 */
export default async function ShopDirectoryPage() {
  const shops = await storefrontDAL.listShops();

  return (
    <PageShell width="wide">
      <SectionHeader overline="Directory" title="Shops on Bhendi Bazaar" />

      {shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shops yet"
          description="Nobody is trading here just yet. Check back soon."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <li key={shop.handle}>
              <Link
                href={`/store/${shop.handle}`}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                {shop.logoUrl ? (
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-card bg-muted">
                    <Image
                      src={shop.logoUrl}
                      alt={`${shop.name} logo`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-card bg-muted">
                    <Store className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {shop.name}
                  </p>
                  {shop.tagline && (
                    <p className="truncate text-xs text-muted-foreground">
                      {shop.tagline}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
