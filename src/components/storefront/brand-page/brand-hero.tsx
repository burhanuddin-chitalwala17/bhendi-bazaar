import Image from "next/image";
import Link from "next/link";

import { StorefrontIdentity } from "@/components/storefront/storefront-identity";
import { Button } from "@/components/ui/button";
import type { BrandPage } from "@/data-access-layer/storefront.dal";
import { ProofStrip } from "./proof-strip";

/**
 * The first phone screen (brand-page R3): cover, mark, name, tagline, where and since
 * when, the proof strip, and the call to shop — reachable without scrolling because it is
 * docked above the tab bar until `md`, where it rejoins the flow (ADR-0016). One element
 * in two positions, so a screen reader meets one "shop" target, not two.
 *
 * The mark, name and tagline are the storefront's own masthead, so a visitor moving
 * between the two pages sees one shop. The accent reaches this page through
 * `StorefrontTheme` exactly as it reaches the landing page (R7).
 */
export function BrandHero({ page }: { page: BrandPage }) {
  const facts = [page.location, `Since ${page.since}`].filter(Boolean);

  return (
    <header className="space-y-4">
      {page.heroUrl && (
        <div className="relative aspect-banner-source w-full overflow-hidden rounded-card bg-muted md:aspect-video">
          <Image
            src={page.heroUrl}
            alt={`${page.name} cover`}
            fill
            // Honest about the slot (ADR-0026): the page is PageShell width="narrow", so
            // the picture caps at 48rem. It is the page's LCP, hence `priority`.
            sizes="(min-width: 768px) 48rem, 100vw"
            className="object-cover"
            preload
          />
        </div>
      )}

      <StorefrontIdentity shop={page} />

      <p className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
        {facts.join(" · ")}
      </p>

      <ProofStrip proof={page.proof} />

      <div className="fixed inset-x-0 bottom-tabbar z-30 border-t border-border/60 bg-background/95 px-3 py-2 backdrop-blur md:static md:inset-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <Button asChild size="lg" className="w-full md:w-auto">
          <Link href={`/store/${page.handle}`} prefetch={false}>
            Shop {page.name}
          </Link>
        </Button>
      </div>
    </header>
  );
}
