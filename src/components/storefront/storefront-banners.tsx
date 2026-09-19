import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface StorefrontBanner {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  href: string | null;
}

/**
 * A shop's own signage (storefront-branding R2a).
 *
 * A horizontal rail on a phone so several banners cost one screen rather than several,
 * widening to a grid from `sm:` (ADR-0015). Every picture goes through `next/image`
 * like the rest of the catalogue (ADR-0026).
 *
 * Nothing here can leave the shop: `href` is validated on the way in as this org's own
 * storefront or one of its own products (R2c), so a banner is signage rather than
 * advertising space.
 */
export function StorefrontBanners({ banners }: { banners: StorefrontBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <section
      aria-label="From this shop"
      className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0"
    >
      {banners.map((banner) => {
        const body = (
          <div
            className={cn(
              "relative flex h-full w-[78vw] shrink-0 flex-col justify-end overflow-hidden rounded-card border border-border bg-card sm:w-auto",
              banner.imageUrl ? "aspect-banner-source" : "p-4"
            )}
          >
            {banner.imageUrl && (
              <>
                <Image
                  src={banner.imageUrl}
                  alt={banner.imageAlt ?? banner.title}
                  fill
                  sizes="(min-width: 640px) 36rem, 78vw"
                  className="object-cover"
                />
                {/* The words sit on the picture, so they need their own ground. */}
                <div className="absolute inset-0 bg-gradient-to-t from-scrim/80 to-transparent" />
              </>
            )}
            <div className={cn("relative", banner.imageUrl && "p-4")}>
              <p
                className={cn(
                  "font-heading text-base font-semibold",
                  banner.imageUrl ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {banner.title}
              </p>
              {banner.description && (
                <p
                  className={cn(
                    "mt-0.5 text-2xs",
                    banner.imageUrl
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  )}
                >
                  {banner.description}
                </p>
              )}
            </div>
          </div>
        );

        return banner.href ? (
          <Link key={banner.id} href={banner.href} className="shrink-0 sm:shrink">
            {body}
          </Link>
        ) : (
          <div key={banner.id} className="shrink-0 sm:shrink">
            {body}
          </div>
        );
      })}
    </section>
  );
}
