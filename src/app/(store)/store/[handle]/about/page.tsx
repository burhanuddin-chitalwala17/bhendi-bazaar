import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/shared/page-shell";
import { BrandPageSections } from "@/components/storefront/brand-page/brand-page-sections";
import { StorefrontTheme } from "@/components/storefront/storefront-theme";
import { Button } from "@/components/ui/button";
import { lockedStorefrontMetadata, storefrontClosedTo } from "@/data-access-layer/storefront-access.dal";
import { StorefrontClosed } from "@/components/subscriptions/storefront-closed";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { APP_NAME } from "@/lib/config";
import { renditionUrlForRef } from "@server/content/renditions.service";
import { appUrl } from "@server/shared/app-url";
import { permanentRedirect } from "next/navigation";
import { resolveBrandPage } from "../resolve";
import { STORE_PAGES_COPY } from "../../store-pages-copy";
import { ROUTES } from "@server/shared/routes";

interface BrandPageProps {
  params: Promise<{ handle: string }>;
}

/** The first non-blank line of a text, cut to a preview's length, or null. */
const firstLine = (text: string | null): string | null =>
  text
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 160) ?? null;

/**
 * The page describes itself from the same public face it renders (brand-page R11, D10), so a
 * link pasted into a chat previews the cover, the name and the tagline. `getBrandPage` is
 * request-memoised: metadata and page share one read.
 */
export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  const locked = shop ? await lockedStorefrontMetadata(shop.id, shop.name) : null;
  if (locked) return locked;
  const page = await storefrontDAL.getBrandPage(handle);
  if (!page) return {};

  const description =
    page.tagline ?? firstLine(page.about) ?? STORE_PAGES_COPY.aboutDescription(page.name, APP_NAME);
  const url = `${appUrl()}${ROUTES.storeAbout(page.handle)}`;
  // The cover at the one size every social host agrees on, made once and found thereafter
  // (renditions R2). A host fetches this itself, so the optimizer never sees it and the full
  // cover would go over the wire every time a link is shared.
  const cover = page.heroUrl ? await renditionUrlForRef(page.id, page.heroUrl, "preview") : null;
  const image = cover ?? page.logoUrl;

  return {
    title: STORE_PAGES_COPY.aboutTitle(page.name),
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: page.name,
      description,
      url,
      ...(image ? { images: [{ url: image, alt: page.name }] } : {}),
    },
  };
}

/**
 * The shop's brand page: what makes a stranger on a phone willing to buy from a shop they
 * have never heard of, drawn from what the platform already knows (brand-page spec).
 *
 * A fixed sequence of sections, each present only when it has something to show — the page
 * itself never asks how much the org has written (R2, D4). No contact channel of the shop's
 * own: [contact-us](docs/specs/contact-us/) is platform-scoped (storefront-pages R3).
 */
export default async function StorefrontAboutPage({ params }: BrandPageProps) {
  const { handle } = await params;
  // A themed shop's story is its landing page (Q3): a permanent move, so printed links still arrive.
  const shop = await storefrontDAL.getByHandle(handle);
  // Closed before the brand page's goods are read (feature-access D11).
  if (shop && (await storefrontClosedTo(shop.id))) return <StorefrontClosed shop={shop} />;
  if (shop?.themeKey) permanentRedirect(ROUTES.store(shop.handle));
  const page = await resolveBrandPage(handle);

  return (
    <StorefrontTheme shop={page}>
      {/* The bottom padding clears the docked call to shop on a phone; from md it is back
          in the flow and the layout's own padding is enough. */}
      <PageShell width="narrow" className="space-y-8 pb-16 md:pb-0">
        <BrandPageSections page={page} />

        {/* storefront-pages R6: a visitor is never trapped in one shop. */}
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.home}>{STORE_PAGES_COPY.wholeMarketplace}</Link>
          </Button>
        </div>
      </PageShell>
    </StorefrontTheme>
  );
}
