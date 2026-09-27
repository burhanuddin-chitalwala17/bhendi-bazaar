import Image from "next/image";

import type { Storefront } from "@/data-access-layer/storefront.dal";

/**
 * Who this shop is: its logo, its name, its tagline, its accent.
 *
 * Shared by the storefront and its about page so the two cannot drift into looking
 * like different shops — a visitor moving between them should see the same masthead,
 * not a second interpretation of it.
 *
 * Mobile-first (ADR-0015): the mark sits beside the name at every width because a
 * 56px square and two lines of text fit a 360px phone comfortably; only the sizes
 * grow at `sm:`. Every value comes from a token — the accent is a palette name the
 * org chose, never a colour it supplied (ADR-0022).
 */
export function StorefrontIdentity({
  shop,
}: {
  shop: Pick<Storefront, "name" | "tagline" | "logoUrl">;
}) {
  return (
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
        {/* The accent's most visible expression: a shop that picked one sees it beside
            its own name, on both pages a visitor lands on. */}
        <span
          aria-hidden
          className="mb-1.5 block h-1 w-10 rounded-field bg-primary"
        />
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {shop.name}
        </h1>
        {shop.tagline && (
          <p className="mt-1 text-sm text-muted-foreground">{shop.tagline}</p>
        )}
      </div>
    </div>
  );
}
