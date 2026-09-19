import type { Metadata } from "next";
import Link from "next/link";

import Image from "next/image";

import { PageShell } from "@/components/shared/page-shell";
import { StorefrontIdentity } from "@/components/storefront/storefront-identity";
import { StorefrontTheme } from "@/components/storefront/storefront-theme";
import { Button } from "@/components/ui/button";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { appUrl } from "@server/shared/app-url";
import { resolveStorefront } from "../resolve";

interface AboutPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  if (!shop) return {};
  return {
    title: `About ${shop.name}`,
    description: shop.tagline ?? `About ${shop.name} on Bhendi Bazaar.`,
    alternates: { canonical: `${appUrl()}/store/${shop.handle}/about` },
  };
}

/**
 * What makes a stranger willing to buy from a shop they have never heard of.
 *
 * No contact channel of the shop's own: [contact-us](docs/specs/contact-us/) is
 * platform-scoped for now, so a buyer with a question reaches the platform
 * (storefront-pages R3).
 */
export default async function StorefrontAboutPage({ params }: AboutPageProps) {
  const { handle } = await params;
  const shop = await resolveStorefront(handle);

  return (
    <StorefrontTheme shop={shop}>
      <PageShell width="narrow">
        {shop.heroUrl && (
          <div className="relative aspect-banner-source w-full overflow-hidden rounded-card bg-muted">
            <Image
              src={shop.heroUrl}
              alt={`${shop.name} cover`}
              fill
              // Honest about the slot (ADR-0026): this page is PageShell width="narrow",
              // so the picture caps at 48rem rather than the storefront's 72rem. It is
              // the largest thing here and the page's LCP, hence `priority`.
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <StorefrontIdentity shop={shop} />

        {shop.about ? (
          // Plain text, rendered as text: an org's copy is never markup (ADR-0030 D9).
          <div className="space-y-4 whitespace-pre-line text-base leading-relaxed text-foreground/90">
            {shop.about}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {shop.name} has not written an introduction yet.
          </p>
        )}

        {(shop.deliveryPolicy || shop.returnsPolicy) && (
          <section className="space-y-4 rounded-card border border-border bg-card p-4 md:p-6">
            <h2 className="font-heading text-xl font-semibold">
              This shop&apos;s terms
            </h2>
            {/* R3a: unambiguous whose promise this is. Payment and fraud protection stay
              the platform's and are not a shop's to disclaim. */}
            <p className="text-2xs text-muted-foreground">
              Set by {shop.name}. Payment and fraud protection are Bhendi
              Bazaar&apos;s.
            </p>
            {shop.deliveryPolicy && (
              <div>
                <h3 className="text-sm font-medium">Delivery</h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {shop.deliveryPolicy}
                </p>
              </div>
            )}
            {shop.returnsPolicy && (
              <div>
                <h3 className="text-sm font-medium">Returns</h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {shop.returnsPolicy}
                </p>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/store/${shop.handle}`}>See what they sell</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">The whole marketplace</Link>
          </Button>
        </div>
      </PageShell>
    </StorefrontTheme>
  );
}
