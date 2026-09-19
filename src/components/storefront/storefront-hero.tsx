import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Storefront } from "@/data-access-layer/storefront.dal";

/**
 * The shop's own identity, at the top of its own page.
 *
 * Mobile-first (ADR-0015): the mark, the name and the tagline stack in reading order on
 * a phone and sit beside the hero from `sm:`. Every value comes from a token — the
 * accent is a palette name the org chose, never a colour it supplied (ADR-0022).
 *
 * Every picture goes through `next/image`: a hero is the heaviest thing a storefront
 * serves and the transfer allowance is shared with the whole catalogue, so it is
 * optimized like everything else (ADR-0026, storefront-branding R9a/R9b).
 */
export function StorefrontHero({ shop }: { shop: Storefront }) {
  return (
    <header className="space-y-4">
      {shop.heroUrl && (
        <div className="relative aspect-banner-source w-full overflow-hidden rounded-card bg-muted">
          <Image
            src={shop.heroUrl}
            alt={`${shop.name} storefront banner`}
            fill
            // Honest about the slot it actually fills (ADR-0026): the page container
            // caps at max-w-page, full bleed below that. Matches hero-banner.tsx — a
            // storefront hero sits in the same column as the platform's.
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="flex items-start gap-3 sm:gap-4">
        {shop.logoUrl && (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-card bg-muted sm:size-16">
            <Image
              src={shop.logoUrl}
              alt={`${shop.name} logo`}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {shop.name}
          </h1>
          {shop.tagline && (
            <p className="mt-1 text-sm text-muted-foreground">{shop.tagline}</p>
          )}
        </div>
      </div>

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
